import type { determineEnemySpecies } from "#app/ai/ai-species-gen";
import { defaultStarterSpecies } from "#app/constants";
import { globalScene } from "#app/global-scene";
import { speciesStarterCosts } from "#balance/starters";
import { allMoves } from "#data/data-lists";
import { Gender, getGenderSymbol } from "#data/gender";
import { BiomeId } from "#enums/biome-id";
import { MoveId } from "#enums/move-id";
import { Nature } from "#enums/nature";
import { PokeballType } from "#enums/pokeball";
import { PokemonType } from "#enums/pokemon-type";
import { SpeciesFormKey } from "#enums/species-form-key";
import { SpeciesId } from "#enums/species-id";
import { TimeOfDay } from "#enums/time-of-day";
import { WeatherType } from "#enums/weather-type";
import type { Pokemon } from "#field/pokemon";
import type { SpeciesStatBoosterItem, SpeciesStatBoosterModifierType } from "#modifiers/modifier-type";
import type { EvoLevelThreshold } from "#types/species-gen-types";
import { coerceArray } from "#utils/array";
import { randSeedInt } from "#utils/common";
import { getPokemonSpecies } from "#utils/pokemon-utils";
import { toCamelCase } from "#utils/strings";
import i18next from "i18next";

export enum EvolutionItem {
  NONE,

  LINKING_CORD,
  SUN_STONE,
  MOON_STONE,
  LEAF_STONE,
  FIRE_STONE,
  WATER_STONE,
  THUNDER_STONE,
  ICE_STONE,
  DUSK_STONE,
  DAWN_STONE,
  SHINY_STONE,
  CRACKED_POT,
  SWEET_APPLE,
  TART_APPLE,
  STRAWBERRY_SWEET,
  UNREMARKABLE_TEACUP,
  UPGRADE,
  DUBIOUS_DISC,
  DRAGON_SCALE,
  PRISM_SCALE,
  RAZOR_CLAW,
  RAZOR_FANG,
  OVAL_STONE,
  REAPER_CLOTH,
  ELECTIRIZER,
  MAGMARIZER,
  PROTECTOR,
  SACHET,
  WHIPPED_DREAM,
  SYRUPY_APPLE,
  CHIPPED_POT,
  GALARICA_CUFF,
  GALARICA_WREATH,
  AUSPICIOUS_ARMOR,
  MALICIOUS_ARMOR,
  MASTERPIECE_TEACUP,
  SUN_FLUTE,
  MOON_FLUTE,

  BLACK_AUGURITE = 51,
  PEAT_BLOCK,
  METAL_ALLOY,
  SCROLL_OF_DARKNESS,
  SCROLL_OF_WATERS,
  LEADERS_CREST
}

const tyrogueMoves = [MoveId.LOW_SWEEP, MoveId.MACH_PUNCH, MoveId.RAPID_SPIN] as const;
type TyrogueMove = (typeof tyrogueMoves)[number];

const EvoCondKey = {
  FRIENDSHIP: 1,
  TIME: 2,
  MOVE: 3,
  MOVE_TYPE: 4,
  PARTY_TYPE: 5,
  WEATHER: 6,
  BIOME: 7,
  TYROGUE: 8,
  SHEDINJA: 9,
  EVO_TREASURE_TRACKER: 10,
  RANDOM_FORM: 11,
  SPECIES_CAUGHT: 12,
  GENDER: 13,
  NATURE: 14,
  HELD_ITEM: 15, // Currently checks only for species stat booster items
} as const;

type EvolutionConditionData =
  {key: typeof EvoCondKey.FRIENDSHIP | typeof EvoCondKey.RANDOM_FORM | typeof EvoCondKey.EVO_TREASURE_TRACKER, value: number} |
  {key: typeof EvoCondKey.MOVE, move: MoveId} |
  {key: typeof EvoCondKey.TIME, time: TimeOfDay[]} |
  {key: typeof EvoCondKey.BIOME, biome: BiomeId[]} |
  {key: typeof EvoCondKey.GENDER, gender: Gender} |
  {key: typeof EvoCondKey.MOVE_TYPE | typeof EvoCondKey.PARTY_TYPE, pkmnType: PokemonType} |
  {key: typeof EvoCondKey.SPECIES_CAUGHT, speciesCaught: SpeciesId} |
  {key: typeof EvoCondKey.HELD_ITEM, itemKey: SpeciesStatBoosterItem} |
  {key: typeof EvoCondKey.NATURE, nature: Nature[]} |
  {key: typeof EvoCondKey.WEATHER, weather: WeatherType[]} |
  {key: typeof EvoCondKey.TYROGUE, move: TyrogueMove} |
  {key: typeof EvoCondKey.SHEDINJA};

export class SpeciesEvolutionCondition {
  public data: EvolutionConditionData[];
  private desc: string[];

  constructor(...data: EvolutionConditionData[]) {
    this.data = data;
  }

  public get description(): string[] {
    if (this.desc != null) {
      return this.desc;
    }
    this.desc = this.data.map(cond => {
      switch(cond.key) {
        case EvoCondKey.FRIENDSHIP:
          return i18next.t("pokemonEvolutions:friendship");
        case EvoCondKey.TIME:
          return i18next.t(`pokemonEvolutions:timeOfDay.${toCamelCase(TimeOfDay[cond.time.at(-1)!])}`); // For Day and Night evos, the key we want goes last
        case EvoCondKey.MOVE_TYPE:
          return i18next.t("pokemonEvolutions:moveType", {type: i18next.t(`pokemonInfo:type.${toCamelCase(PokemonType[cond.pkmnType])}`)});
        case EvoCondKey.PARTY_TYPE:
          return i18next.t("pokemonEvolutions:partyType", {type: i18next.t(`pokemonInfo:type.${toCamelCase(PokemonType[cond.pkmnType])}`)});
        case EvoCondKey.GENDER:
          return i18next.t("pokemonEvolutions:gender", {gender: getGenderSymbol(cond.gender)});
        case EvoCondKey.MOVE:
        case EvoCondKey.TYROGUE:
          return i18next.t("pokemonEvolutions:move", {move: allMoves[cond.move].name});
        case EvoCondKey.BIOME:
          return i18next.t("pokemonEvolutions:biome");
        case EvoCondKey.NATURE:
          return i18next.t("pokemonEvolutions:nature");
        case EvoCondKey.WEATHER:
          return i18next.t("pokemonEvolutions:weather");
        case EvoCondKey.SHEDINJA:
          return i18next.t("pokemonEvolutions:shedinja");
        case EvoCondKey.EVO_TREASURE_TRACKER:
          return i18next.t("pokemonEvolutions:treasure");
        case EvoCondKey.SPECIES_CAUGHT:
          return i18next.t("pokemonEvolutions:caught", {species: getPokemonSpecies(cond.speciesCaught).name});
        case EvoCondKey.HELD_ITEM:
          return i18next.t(`pokemonEvolutions:heldItem.${toCamelCase(cond.itemKey)}`);
        case EvoCondKey.RANDOM_FORM:
          return null;
        default:
          cond satisfies never;
          return null;
      }
    }).filter(s => s != null); // Filter out stringless conditions
    return this.desc;
  }

  public conditionsFulfilled(pokemon: Pokemon, forFusion = false): boolean {
    console.log(this.data);
    return this.data.every(cond => {
      switch (cond.key) {
        case EvoCondKey.FRIENDSHIP:
          return pokemon.friendship >= cond.value;
        case EvoCondKey.TIME:
          return cond.time.includes(globalScene.arena.getTimeOfDay());
        case EvoCondKey.MOVE:
          return pokemon.moveset.some(m => m.moveId === cond.move);
        case EvoCondKey.MOVE_TYPE:
          return pokemon.moveset.some(m => m.getMove().type === cond.pkmnType);
        case EvoCondKey.PARTY_TYPE:
          return globalScene.getPlayerParty().some(p => p.getTypes(false, false, true).includes(cond.pkmnType));
        case EvoCondKey.EVO_TREASURE_TRACKER:
          return pokemon.getHeldItems().some(m =>
            m.is("EvoTrackerModifier") &&
            m.getStackCount() + pokemon.getPersistentTreasureCount() >= cond.value
          );
        case EvoCondKey.GENDER:
          return cond.gender === (forFusion ? pokemon.fusionGender : pokemon.gender);
        case EvoCondKey.SHEDINJA: // Shedinja cannot be evolved into directly
          return false;
        case EvoCondKey.BIOME:
          return cond.biome.includes(globalScene.arena.biomeId);
        case EvoCondKey.WEATHER:
          return cond.weather.includes(globalScene.arena.weatherType);
        case EvoCondKey.TYROGUE:
          return (
            pokemon.getMoveset(true).find(m => (tyrogueMoves as readonly MoveId[]).includes(m.moveId))?.moveId
            === cond.move
          );
        case EvoCondKey.NATURE:
          return cond.nature.includes(pokemon.getNature());
        case EvoCondKey.RANDOM_FORM: {
          let ret = false;
          globalScene.executeWithSeedOffset(() => ret = !randSeedInt(cond.value), pokemon.id);
          return ret;
        }
        case EvoCondKey.SPECIES_CAUGHT:
          return !!globalScene.gameData.dexData[cond.speciesCaught].caughtAttr;
        case EvoCondKey.HELD_ITEM:
          return pokemon.getHeldItems().some(m => m.is("SpeciesStatBoosterModifier") && (m.type as SpeciesStatBoosterModifierType).key === cond.itemKey);
        default:
          cond satisfies never;
          return false;
      }
    });
  }
}

export function validateShedinjaEvo(): boolean {
  return globalScene.getPlayerParty().length < 6 && globalScene.pokeballCounts[PokeballType.POKEBALL] > 0;
}

export class SpeciesFormEvolution {
  public speciesId: SpeciesId;
  public preFormKey: string | null;
  public evoFormKey: string | null;
  public level: number;
  public item: EvolutionItem | null;
  public condition: SpeciesEvolutionCondition | null;
  /**
   * A triple containing the level thresholds for evolutions based on the encounter sort
   * @see {@linkcode EvoLevelThreshold}
   * @see {@linkcode determineEnemySpecies}
   */
  public evoLevelThreshold?: EvoLevelThreshold;
  public desc = "";

  constructor(speciesId: SpeciesId, preFormKey: string | null, evoFormKey: string | null, level: number, item: EvolutionItem | null, condition: EvolutionConditionData | EvolutionConditionData[] | null, evoDelay?: EvoLevelThreshold) {
    this.speciesId = speciesId;
    this.preFormKey = preFormKey;
    this.evoFormKey = evoFormKey;
    this.level = level;
    this.item = item || EvolutionItem.NONE;
    if (condition != null) {
      this.condition = new SpeciesEvolutionCondition(...coerceArray(condition));
    }
    if (evoDelay != null) {
      this.evoLevelThreshold = evoDelay;
    }
  }

  get description(): string {
    if (this.desc.length > 0) {
      return this.desc;
    }

    const strings: string[] = [];
    let len = 0;
    if (this.level > 1) {
      strings.push(i18next.t("pokemonEvolutions:atLevel", {lv: this.level}));
    }
    if (this.item) {
      const itemDescription = i18next.t(`modifierType:EvolutionItem.${EvolutionItem[this.item].toUpperCase()}`);
      const rarity = this.item > 50 ? i18next.t("pokemonEvolutions:ultra") : i18next.t("pokemonEvolutions:great");
      strings.push(i18next.t("pokemonEvolutions:using", {item: itemDescription, tier: rarity}));
    }
    if (this.condition) {
      if (strings.length === 0) {
        strings.push(i18next.t("pokemonEvolutions:levelUp"));
      }
      strings.push(...this.condition.description);
    }
    this.desc = strings
      .filter(str => str !== "")
      .map((str, index) => {
        if (index === 0) {
          len = str.length;
          return str;
        }
        if (len + str.length > 60) {
          len = str.length;
          return "\n" + str[0].toLowerCase() + str.slice(1);
        }
        len += str.length;
        return str[0].toLowerCase() + str.slice(1);
      })
      .join(" ")
      .replace(" \n", i18next.t("pokemonEvolutions:connector") + "\n");

    return this.desc;
  }

  /**
   * Checks if a Pokemon fulfills the requirements of this evolution.
   * @param pokemon {@linkcode Pokemon} who wants to evolve
   * @param forFusion defaults to False. Whether this evolution is meant for the secondary fused mon. In that case, use their form key.
   * @param item {@linkcode EvolutionItem} optional, check if the evolution uses a certain item
   * @returns whether this evolution can apply to the Pokemon
   */
  public validate(pokemon: Pokemon, forFusion = false, item?: EvolutionItem): boolean {
    return (
      pokemon.level >= this.level &&
      // Check form key, using the fusion's form key if we're checking the fusion
      (this.preFormKey == null || (forFusion ? pokemon.getFusionFormKey() : pokemon.getFormKey()) === this.preFormKey) &&
      (this.condition == null || this.condition.conditionsFulfilled(pokemon, forFusion)) &&
      ((item ?? EvolutionItem.NONE) === (this.item ?? EvolutionItem.NONE))
    );
  }

  /**
   * Checks if this evolution is item-based and any conditions for it are fulfilled
   * @param pokemon {@linkcode Pokemon} who wants to evolve
   * @param forFusion defaults to False. Whether this evolution is meant for the secondary fused mon. In that case, use their form key.
   * @returns whether this evolution uses an item and can apply to the Pokemon
   */
  public isValidItemEvolution(pokemon: Pokemon, forFusion = false): boolean {
    return (
      this.item != null &&
      pokemon.level >= this.level &&
      // Check form key, using the fusion's form key if we're checking the fusion
      (this.preFormKey == null || (forFusion ? pokemon.getFusionFormKey() : pokemon.getFormKey()) === this.preFormKey) &&
      (this.condition == null || this.condition.conditionsFulfilled(pokemon))
    );
  }

  public get evoItem(): EvolutionItem {
    return this.item ?? EvolutionItem.NONE;
  }
}

export class SpeciesEvolution extends SpeciesFormEvolution {
  constructor(speciesId: SpeciesId, level: number, item: EvolutionItem | null, condition: EvolutionConditionData | EvolutionConditionData[] | null, evoDelay?: EvoLevelThreshold) {
    super(speciesId, null, null, level, item, condition, evoDelay);
  }
}

export class FusionSpeciesFormEvolution extends SpeciesFormEvolution {
  public primarySpeciesId: SpeciesId;

  constructor(primarySpeciesId: SpeciesId, evolution: SpeciesFormEvolution) {
    super(evolution.speciesId, evolution.preFormKey, evolution.evoFormKey, evolution.level, evolution.item, evolution.condition?.data ?? null, evolution.evoLevelThreshold);

    this.primarySpeciesId = primarySpeciesId;
  }
}

interface PokemonEvolutions {
  [key: string]: SpeciesFormEvolution[]
}

export const pokemonEvolutions: PokemonEvolutions = {
  [SpeciesId.BULBASAUR]: [
    new SpeciesEvolution(SpeciesId.IVYSAUR, 23, null, null)
  ],
  [SpeciesId.IVYSAUR]: [
    new SpeciesEvolution(SpeciesId.VENUSAUR, 37, null, null)
  ],
  [SpeciesId.CHARMANDER]: [
    new SpeciesEvolution(SpeciesId.CHARMELEON, 22, null, null)
  ],
  [SpeciesId.CHARMELEON]: [
    new SpeciesEvolution(SpeciesId.CHARIZARD, 37, null, null)
  ],
  [SpeciesId.SQUIRTLE]: [
    new SpeciesEvolution(SpeciesId.WARTORTLE, 23, null, null)
  ],
  [SpeciesId.WARTORTLE]: [
    new SpeciesEvolution(SpeciesId.BLASTOISE, 37, null, null)
  ],
  [SpeciesId.CATERPIE]: [
    new SpeciesEvolution(SpeciesId.METAPOD, 7, null, null)
  ],
  [SpeciesId.METAPOD]: [
    new SpeciesEvolution(SpeciesId.BUTTERFREE, 12, null, null)
  ],
  [SpeciesId.WEEDLE]: [
    new SpeciesEvolution(SpeciesId.KAKUNA, 7, null, null)
  ],
  [SpeciesId.KAKUNA]: [
    new SpeciesEvolution(SpeciesId.BEEDRILL, 12, null, null)
  ],
  [SpeciesId.PIDGEY]: [
    new SpeciesEvolution(SpeciesId.PIDGEOTTO, 14, null, null)
  ],
  [SpeciesId.PIDGEOTTO]: [
    new SpeciesEvolution(SpeciesId.PIDGEOT, 30, null, null)
  ],
  [SpeciesId.RATTATA]: [
    new SpeciesEvolution(SpeciesId.RATICATE, 20, null, null)
  ],
  [SpeciesId.SPEAROW]: [
    new SpeciesEvolution(SpeciesId.FEAROW, 21, null, null)
  ],
  [SpeciesId.EKANS]: [
    new SpeciesEvolution(SpeciesId.ARBOK, 23, null, null)
  ],
  [SpeciesId.SANDSHREW]: [
    new SpeciesEvolution(SpeciesId.SANDSLASH, 26, null, null)
  ],
  [SpeciesId.NIDORAN_F]: [
    new SpeciesEvolution(SpeciesId.NIDORINA, 16, null, null)
  ],
  [SpeciesId.NIDORINA]: [
    new SpeciesEvolution(SpeciesId.NIDOQUEEN, 33, null, null)
  ],
  [SpeciesId.NIDORAN_M]: [
    new SpeciesEvolution(SpeciesId.NIDORINO, 16, null, null)
  ],
  [SpeciesId.NIDORINO]: [
    new SpeciesEvolution(SpeciesId.NIDOKING, 33, null, null)
  ],
  [SpeciesId.VULPIX]: [
    new SpeciesEvolution(SpeciesId.NINETALES, 27, null, null)
  ],
  [SpeciesId.ZUBAT]: [
    new SpeciesEvolution(SpeciesId.GOLBAT, 21, null, null)
  ],
  [SpeciesId.GOLBAT]: [
    new SpeciesEvolution(SpeciesId.CROBAT, 40, null, null)
  ],
  [SpeciesId.ODDISH]: [
    new SpeciesEvolution(SpeciesId.GLOOM, 21, null, null)
  ],
  [SpeciesId.GLOOM]: [
    new SpeciesEvolution(SpeciesId.VILEPLUME, 33, null, null),
    new SpeciesEvolution(SpeciesId.BELLOSSOM, 33, null, null),
  ],
  [SpeciesId.PARAS]: [
    new SpeciesEvolution(SpeciesId.PARASECT, 22, null, null)
  ],
  [SpeciesId.VENONAT]: [
    new SpeciesEvolution(SpeciesId.VENOMOTH, 26, null, null)
  ],
  [SpeciesId.DIGLETT]: [
    new SpeciesEvolution(SpeciesId.DUGTRIO, 21, null, null)
  ],
  [SpeciesId.MEOWTH]: [
    new SpeciesFormEvolution(SpeciesId.PERSIAN, "", "", 23, null, null)
  ],
  [SpeciesId.PSYDUCK]: [
    new SpeciesEvolution(SpeciesId.GOLDUCK, 30, null, null)
  ],
  [SpeciesId.MANKEY]: [
    new SpeciesEvolution(SpeciesId.PRIMEAPE, 26, null, null)
  ],
  [SpeciesId.PRIMEAPE]: [
    new SpeciesEvolution(SpeciesId.ANNIHILAPE, 40, null, null)
  ],
  [SpeciesId.GROWLITHE]: [
    new SpeciesEvolution(SpeciesId.ARCANINE, 35, null, null)
  ],
  [SpeciesId.POLIWAG]: [
    new SpeciesEvolution(SpeciesId.POLIWHIRL, 19, null, null)
  ],
  [SpeciesId.POLIWHIRL]: [
    new SpeciesEvolution(SpeciesId.POLIWRATH, 35, null, null),
    new SpeciesEvolution(SpeciesId.POLITOED, 35, null, null),
  ],
  [SpeciesId.ABRA]: [
    new SpeciesEvolution(SpeciesId.KADABRA, 23, null, null)
  ],
  [SpeciesId.KADABRA]: [
    new SpeciesEvolution(SpeciesId.ALAKAZAM, 35, null, null)
  ],
  [SpeciesId.MACHOP]: [
    new SpeciesEvolution(SpeciesId.MACHOKE, 22, null, null)
  ],
  [SpeciesId.MACHOKE]: [
    new SpeciesEvolution(SpeciesId.MACHAMP, 35, null, null)
  ],
  [SpeciesId.BELLSPROUT]: [
    new SpeciesEvolution(SpeciesId.WEEPINBELL, 19, null, null)
  ],
  [SpeciesId.WEEPINBELL]: [
    new SpeciesEvolution(SpeciesId.VICTREEBEL, 33, null, null)
  ],
  [SpeciesId.TENTACOOL]: [
    new SpeciesEvolution(SpeciesId.TENTACRUEL, 31, null, null)
  ],
  [SpeciesId.GEODUDE]: [
    new SpeciesEvolution(SpeciesId.GRAVELER, 19, null, null)
  ],
  [SpeciesId.GRAVELER]: [
    new SpeciesEvolution(SpeciesId.GOLEM, 35, null, null)
  ],
  [SpeciesId.PONYTA]: [
    new SpeciesEvolution(SpeciesId.RAPIDASH, 36, null, null)
  ],
  [SpeciesId.SLOWPOKE]: [
    new SpeciesEvolution(SpeciesId.SLOWBRO, 28, null, null),
    new SpeciesEvolution(SpeciesId.SLOWKING, 28, null, null),
  ],
  [SpeciesId.MAGNEMITE]: [
    new SpeciesEvolution(SpeciesId.MAGNETON, 28, null, null)
  ],
  [SpeciesId.MAGNETON]: [
    new SpeciesEvolution(SpeciesId.MAGNEZONE, 41, null, null)
  ],
  [SpeciesId.DODUO]: [
    new SpeciesEvolution(SpeciesId.DODRIO, 28, null, null)
  ],
  [SpeciesId.SEEL]: [
    new SpeciesEvolution(SpeciesId.DEWGONG, 28, null, null)
  ],
  [SpeciesId.GRIMER]: [
    new SpeciesEvolution(SpeciesId.MUK, 30, null, null)
  ],
  [SpeciesId.SHELLDER]: [
    new SpeciesEvolution(SpeciesId.CLOYSTER, 28, null, null)
  ],
  [SpeciesId.GASTLY]: [
    new SpeciesEvolution(SpeciesId.HAUNTER, 23, null, null)
  ],
  [SpeciesId.HAUNTER]: [
    new SpeciesEvolution(SpeciesId.GENGAR, 35, null, null)
  ],
  [SpeciesId.ONIX]: [
    new SpeciesEvolution(SpeciesId.STEELIX, 35, null, null)
  ],
  [SpeciesId.DROWZEE]: [
    new SpeciesEvolution(SpeciesId.HYPNO, 29, null, null)
  ],
  [SpeciesId.KRABBY]: [
    new SpeciesEvolution(SpeciesId.KINGLER, 28, null, null)
  ],
  [SpeciesId.VOLTORB]: [
    new SpeciesEvolution(SpeciesId.ELECTRODE, 30, null, null)
  ],
  [SpeciesId.EXEGGCUTE]: [
    new SpeciesEvolution(SpeciesId.EXEGGUTOR, 30, null, null),
    new SpeciesEvolution(SpeciesId.ALOLA_EXEGGUTOR, 30, null, null),
  ],
  [SpeciesId.CUBONE]: [
    new SpeciesEvolution(SpeciesId.MAROWAK, 26, null, null),
    new SpeciesEvolution(SpeciesId.ALOLA_MAROWAK, 26, null, null),
    ],
  [SpeciesId.LICKITUNG]: [
    new SpeciesEvolution(SpeciesId.LICKILICKY, 35, null, null)
  ],
  [SpeciesId.KOFFING]: [
    new SpeciesEvolution(SpeciesId.WEEZING, 30, null, null),
    new SpeciesEvolution(SpeciesId.GALAR_WEEZING, 30, null, null),
  ],
  [SpeciesId.RHYHORN]: [
    new SpeciesEvolution(SpeciesId.RHYDON, 30, null, null)
  ],
  [SpeciesId.RHYDON]: [
    new SpeciesEvolution(SpeciesId.RHYPERIOR, 41, null, null)
  ],
  [SpeciesId.TANGELA]: [
    new SpeciesEvolution(SpeciesId.TANGROWTH, 38, null, null)
  ],
  [SpeciesId.HORSEA]: [
    new SpeciesEvolution(SpeciesId.SEADRA, 23, null, null)
  ],
  [SpeciesId.SEADRA]: [
    new SpeciesEvolution(SpeciesId.KINGDRA, 39, null, null)
  ],
  [SpeciesId.GOLDEEN]: [
    new SpeciesEvolution(SpeciesId.SEAKING, 28, null, null)
  ],
  [SpeciesId.STARYU]: [
    new SpeciesEvolution(SpeciesId.STARMIE, 32, null, null)
  ],
  [SpeciesId.SCYTHER]: [
    new SpeciesEvolution(SpeciesId.SCIZOR, 1, null, null),
    new SpeciesEvolution(SpeciesId.KLEAVOR, 1, null, null),
  ],
  [SpeciesId.MAGIKARP]: [
    new SpeciesEvolution(SpeciesId.GYARADOS, 21, null, null)
  ],
  [SpeciesId.EEVEE]: [
    new SpeciesFormEvolution(SpeciesId.VAPOREON, "", "", 30, null, null),
    new SpeciesFormEvolution(SpeciesId.JOLTEON, "", "", 30, null, null),
    new SpeciesFormEvolution(SpeciesId.FLAREON, "", "", 30, null, null),
    new SpeciesFormEvolution(SpeciesId.ESPEON, "", "", 30, null, null),
    new SpeciesFormEvolution(SpeciesId.UMBREON, "", "", 30, null, null),
    new SpeciesFormEvolution(SpeciesId.LEAFEON, "", "", 30, null, null),
    new SpeciesFormEvolution(SpeciesId.GLACEON, "", "", 30, null, null),
    new SpeciesFormEvolution(SpeciesId.SYLVEON, "", "", 30, null, null),
  ],
  [SpeciesId.PORYGON]: [
    new SpeciesEvolution(SpeciesId.PORYGON2, 36, null, null)
  ],
  [SpeciesId.PORYGON2]: [
    new SpeciesEvolution(SpeciesId.PORYGON_Z, 44, null, null)
  ],
  [SpeciesId.OMANYTE]: [
    new SpeciesEvolution(SpeciesId.OMASTAR, 31, null, null)
  ],
  [SpeciesId.KABUTO]: [
    new SpeciesEvolution(SpeciesId.KABUTOPS, 31, null, null)
  ],
  [SpeciesId.DRATINI]: [
    new SpeciesEvolution(SpeciesId.DRAGONAIR, 24, null, null)
  ],
  [SpeciesId.DRAGONAIR]: [
    new SpeciesEvolution(SpeciesId.DRAGONITE, 42, null, null)
  ],
  [SpeciesId.CHIKORITA]: [
    new SpeciesEvolution(SpeciesId.BAYLEEF, 23, null, null)
  ],
  [SpeciesId.BAYLEEF]: [
    new SpeciesEvolution(SpeciesId.MEGANIUM, 37, null, null)
  ],
  [SpeciesId.CYNDAQUIL]: [
    new SpeciesEvolution(SpeciesId.QUILAVA, 22, null, null)
  ],
  [SpeciesId.QUILAVA]: [
    new SpeciesEvolution(SpeciesId.TYPHLOSION, 37, null, null),
    new SpeciesEvolution(SpeciesId.HISUI_TYPHLOSION, 37, null, null),
  ],
  [SpeciesId.TOTODILE]: [
    new SpeciesEvolution(SpeciesId.CROCONAW, 23, null, null)
  ],
  [SpeciesId.CROCONAW]: [
    new SpeciesEvolution(SpeciesId.FERALIGATR, 37, null, null)
  ],
  [SpeciesId.SENTRET]: [
    new SpeciesEvolution(SpeciesId.FURRET, 16, null, null)
  ],
  [SpeciesId.HOOTHOOT]: [
    new SpeciesEvolution(SpeciesId.NOCTOWL, 23, null, null)
  ],
  [SpeciesId.LEDYBA]: [
    new SpeciesEvolution(SpeciesId.LEDIAN, 17, null, null)
  ],
  [SpeciesId.SPINARAK]: [
    new SpeciesEvolution(SpeciesId.ARIADOS, 19, null, null)
  ],
  [SpeciesId.CHINCHOU]: [
    new SpeciesEvolution(SpeciesId.LANTURN, 29, null, null)
  ],
  [SpeciesId.PICHU]: [
    new SpeciesFormEvolution(SpeciesId.PIKACHU, "", "", 11, null, null),
    new SpeciesFormEvolution(SpeciesId.PIKACHU, "spiky", "partner", 15, null, null),
  ],
  [SpeciesId.PIKACHU]: [
    new SpeciesFormEvolution(SpeciesId.RAICHU, "", "", 29, null, null),
    new SpeciesFormEvolution(SpeciesId.ALOLA_RAICHU, "", "", 29, null, null),
  ],
  [SpeciesId.CLEFFA]: [
    new SpeciesEvolution(SpeciesId.CLEFAIRY, 12, null, null)
  ],
  [SpeciesId.CLEFAIRY]: [
    new SpeciesEvolution(SpeciesId.CLEFABLE, 29, null, null)
  ],
  [SpeciesId.IGGLYBUFF]: [
    new SpeciesEvolution(SpeciesId.JIGGLYPUFF, 8, null, null)
  ],
  [SpeciesId.JIGGLYPUFF]: [
    new SpeciesEvolution(SpeciesId.WIGGLYTUFF, 22, null, null)
  ],
  [SpeciesId.TOGEPI]: [
    new SpeciesEvolution(SpeciesId.TOGETIC, 19, null, null)
  ],
  [SpeciesId.TOGETIC]: [
    new SpeciesEvolution(SpeciesId.TOGEKISS, 37, null, null)
  ],
  [SpeciesId.NATU]: [
    new SpeciesEvolution(SpeciesId.XATU, 28, null, null)
  ],
  [SpeciesId.MAREEP]: [
    new SpeciesEvolution(SpeciesId.FLAAFFY, 17, null, null)
  ],
  [SpeciesId.FLAAFFY]: [
    new SpeciesEvolution(SpeciesId.AMPHAROS, 33, null, null)
  ],
  [SpeciesId.HOPPIP]: [
    new SpeciesEvolution(SpeciesId.SKIPLOOM, 14, null, null)
  ],
  [SpeciesId.SKIPLOOM]: [
    new SpeciesEvolution(SpeciesId.JUMPLUFF, 30, null, null)
  ],
  [SpeciesId.AIPOM]: [
    new SpeciesEvolution(SpeciesId.AMBIPOM, 32, null, null)
  ],
  [SpeciesId.SUNKERN]: [
    new SpeciesEvolution(SpeciesId.SUNFLORA, 13, null, null)
  ],
  [SpeciesId.YANMA]: [
    new SpeciesEvolution(SpeciesId.YANMEGA, 36, null, null)
  ],
  [SpeciesId.WOOPER]: [
    new SpeciesEvolution(SpeciesId.QUAGSIRE, 16, null, null)
  ],
  [SpeciesId.MURKROW]: [
    new SpeciesEvolution(SpeciesId.HONCHKROW, 35, null, null)
  ],
  [SpeciesId.MISDREAVUS]: [
    new SpeciesEvolution(SpeciesId.MISMAGIUS, 37, null, null)
  ],
  [SpeciesId.GIRAFARIG]: [
    new SpeciesEvolution(SpeciesId.FARIGIRAF, 40, null, null)
  ],
  [SpeciesId.PINECO]: [
    new SpeciesEvolution(SpeciesId.FORRETRESS, 26, null, null)
  ],
  [SpeciesId.DUNSPARCE]: [
    new SpeciesFormEvolution(SpeciesId.DUDUNSPARCE, "", "three-segment", 38, null, {key: EvoCondKey.RANDOM_FORM, value: 4}),
    new SpeciesFormEvolution(SpeciesId.DUDUNSPARCE, "", "two-segment", 38, null, null),
  ],
  [SpeciesId.GLIGAR]: [
    new SpeciesEvolution(SpeciesId.GLISCOR, 38, null, null)
  ],
  [SpeciesId.SNUBBULL]: [
    new SpeciesEvolution(SpeciesId.GRANBULL, 26, null, null)
  ],
  [SpeciesId.SNEASEL]: [
    new SpeciesEvolution(SpeciesId.WEAVILE, 38, null, null)
  ],
  [SpeciesId.TEDDIURSA]: [
    new SpeciesEvolution(SpeciesId.URSARING, 31, null, null)
  ],
  [SpeciesId.URSARING]: [
    new SpeciesEvolution(SpeciesId.URSALUNA, 45, null, null)
  ],
  [SpeciesId.SLUGMA]: [
    new SpeciesEvolution(SpeciesId.MAGCARGO, 20, null, null)
  ],
  [SpeciesId.SWINUB]: [
    new SpeciesEvolution(SpeciesId.PILOSWINE, 22, null, null)
  ],
  [SpeciesId.PILOSWINE]: [
    new SpeciesEvolution(SpeciesId.MAMOSWINE, 40, null, null)
  ],
  [SpeciesId.REMORAID]: [
    new SpeciesEvolution(SpeciesId.OCTILLERY, 27, null, null)
  ],
  [SpeciesId.HOUNDOUR]: [
    new SpeciesEvolution(SpeciesId.HOUNDOOM, 31, null, null)
  ],
  [SpeciesId.PHANPY]: [
    new SpeciesEvolution(SpeciesId.DONPHAN, 31, null, null)
  ],
  [SpeciesId.STANTLER]: [
    new SpeciesEvolution(SpeciesId.WYRDEER, 41, null, null)
  ],
  [SpeciesId.TYROGUE]: [
    /**
     * Custom: Evolves into Hitmonlee, Hitmonchan or Hitmontop at level 20
     * if it knows Low Sweep, Mach Punch, or Rapid Spin, respectively.
     * If Tyrogue knows multiple of these moves, its evolution is based on
     * the first qualifying move in its moveset.
     */
    new SpeciesEvolution(SpeciesId.HITMONLEE, 18, null, null),
    new SpeciesEvolution(SpeciesId.HITMONCHAN, 18, null, null),
    new SpeciesEvolution(SpeciesId.HITMONTOP, 18, null, null),
  ],
  [SpeciesId.SMOOCHUM]: [
    new SpeciesEvolution(SpeciesId.JYNX, 26, null, null)
  ],
  [SpeciesId.ELEKID]: [
    new SpeciesEvolution(SpeciesId.ELECTABUZZ, 32, null, null)
  ],
  [SpeciesId.ELECTABUZZ]: [
    new SpeciesEvolution(SpeciesId.ELECTIVIRE, 42, null, null)
  ],
  [SpeciesId.MAGBY]: [
    new SpeciesEvolution(SpeciesId.MAGMAR, 32, null, null)
  ],
  [SpeciesId.MAGMAR]: [
    new SpeciesEvolution(SpeciesId.MAGMORTAR, 42, null, null)
  ],
  [SpeciesId.LARVITAR]: [
    new SpeciesEvolution(SpeciesId.PUPITAR, 24, null, null)
  ],
  [SpeciesId.PUPITAR]: [
    new SpeciesEvolution(SpeciesId.TYRANITAR, 41, null, null)
  ],
  [SpeciesId.TREECKO]: [
    new SpeciesEvolution(SpeciesId.GROVYLE, 23, null, null)
  ],
  [SpeciesId.GROVYLE]: [
    new SpeciesEvolution(SpeciesId.SCEPTILE, 37, null, null)
  ],
  [SpeciesId.TORCHIC]: [
    new SpeciesEvolution(SpeciesId.COMBUSKEN, 23, null, null)
  ],
  [SpeciesId.COMBUSKEN]: [
    new SpeciesEvolution(SpeciesId.BLAZIKEN, 37, null, null)
  ],
  [SpeciesId.MUDKIP]: [
    new SpeciesEvolution(SpeciesId.MARSHTOMP, 23, null, null)
  ],
  [SpeciesId.MARSHTOMP]: [
    new SpeciesEvolution(SpeciesId.SWAMPERT, 37, null, null)
  ],
  [SpeciesId.POOCHYENA]: [
    new SpeciesEvolution(SpeciesId.MIGHTYENA, 17, null, null)
  ],
  [SpeciesId.ZIGZAGOON]: [
    new SpeciesEvolution(SpeciesId.LINOONE, 19, null, null)
  ],
  [SpeciesId.WURMPLE]: [
    new SpeciesEvolution(SpeciesId.SILCOON, 7, null, null),
    new SpeciesEvolution(SpeciesId.CASCOON, 7, null, null),
  ],
  [SpeciesId.SILCOON]: [
    new SpeciesEvolution(SpeciesId.BEAUTIFLY, 12, null, null)
  ],
  [SpeciesId.CASCOON]: [
    new SpeciesEvolution(SpeciesId.DUSTOX, 12, null, null)
  ],
  [SpeciesId.LOTAD]: [
    new SpeciesEvolution(SpeciesId.LOMBRE, 13, null, null)
  ],
  [SpeciesId.LOMBRE]: [
    new SpeciesEvolution(SpeciesId.LUDICOLO, 30, null, null)
  ],
  [SpeciesId.SEEDOT]: [
    new SpeciesEvolution(SpeciesId.NUZLEAF, 13, null, null)
  ],
  [SpeciesId.NUZLEAF]: [
    new SpeciesEvolution(SpeciesId.SHIFTRY, 30, null, null)
  ],
  [SpeciesId.TAILLOW]: [
    new SpeciesEvolution(SpeciesId.SWELLOW, 24, null, null)
  ],
  [SpeciesId.WINGULL]: [
    new SpeciesEvolution(SpeciesId.PELIPPER, 22, null, null)
  ],
  [SpeciesId.RALTS]: [
    new SpeciesEvolution(SpeciesId.KIRLIA, 7, null, null)
  ],
  [SpeciesId.KIRLIA]: [
    new SpeciesEvolution(SpeciesId.GALLADE, 25, null, {key: EvoCondKey.GENDER, gender: Gender.MALE}),
    new SpeciesEvolution(SpeciesId.GARDEVOIR, 25, null, null),
  ],
  [SpeciesId.SURSKIT]: [
    new SpeciesEvolution(SpeciesId.MASQUERAIN, 23, null, null)
  ],
  [SpeciesId.SHROOMISH]: [
    new SpeciesEvolution(SpeciesId.BRELOOM, 26, null, null)
  ],
  [SpeciesId.SLAKOTH]: [
    new SpeciesEvolution(SpeciesId.VIGOROTH, 23, null, null)
  ],
  [SpeciesId.VIGOROTH]: [
    new SpeciesEvolution(SpeciesId.SLAKING, 44, null, null)
  ],
  [SpeciesId.NINCADA]: [
    new SpeciesEvolution(SpeciesId.NINJASK, 23, null, null),
    new SpeciesEvolution(SpeciesId.SHEDINJA, 23, null, null),
  ],
  [SpeciesId.WHISMUR]: [
    new SpeciesEvolution(SpeciesId.LOUDRED, 15, null, null)
  ],
  [SpeciesId.LOUDRED]: [
    new SpeciesEvolution(SpeciesId.EXPLOUD, 32, null, null)
  ],
  [SpeciesId.MAKUHITA]: [
    new SpeciesEvolution(SpeciesId.HARIYAMA, 20, null, null)
  ],
  [SpeciesId.AZURILL]: [
    new SpeciesEvolution(SpeciesId.MARILL, 7, null, null)
  ],
  [SpeciesId.MARILL]: [
    new SpeciesEvolution(SpeciesId.AZUMARILL, 20, null, null)
  ],
  [SpeciesId.NOSEPASS]: [
    new SpeciesEvolution(SpeciesId.PROBOPASS, 34, null, null)
  ],
  [SpeciesId.SKITTY]: [
    new SpeciesEvolution(SpeciesId.DELCATTY, 20, null, null)
  ],
  [SpeciesId.ARON]: [
    new SpeciesEvolution(SpeciesId.LAIRON, 25, null, null)
  ],
  [SpeciesId.LAIRON]: [
    new SpeciesEvolution(SpeciesId.AGGRON, 38, null, null)
  ],
  [SpeciesId.MEDITITE]: [
    new SpeciesEvolution(SpeciesId.MEDICHAM, 22, null, null)
  ],
  [SpeciesId.ELECTRIKE]: [
    new SpeciesEvolution(SpeciesId.MANECTRIC, 26, null, null)
  ],
  [SpeciesId.GULPIN]: [
    new SpeciesEvolution(SpeciesId.SWALOT, 27, null, null)
  ],
  [SpeciesId.CARVANHA]: [
    new SpeciesEvolution(SpeciesId.SHARPEDO, 27, null, null)
  ],
  [SpeciesId.WAILMER]: [
    new SpeciesEvolution(SpeciesId.WAILORD, 35, null, null)
  ],
  [SpeciesId.NUMEL]: [
    new SpeciesEvolution(SpeciesId.CAMERUPT, 27, null, null)
  ],
  [SpeciesId.SPOINK]: [
    new SpeciesEvolution(SpeciesId.GRUMPIG, 29, null, null)
  ],
  [SpeciesId.TRAPINCH]: [
    new SpeciesEvolution(SpeciesId.VIBRAVA, 16, null, null)
  ],
  [SpeciesId.VIBRAVA]: [
    new SpeciesEvolution(SpeciesId.FLYGON, 32, null, null)
  ],
  [SpeciesId.CACNEA]: [
    new SpeciesEvolution(SpeciesId.CACTURNE, 29, null, null)
  ],
  [SpeciesId.SWABLU]: [
    new SpeciesEvolution(SpeciesId.ALTARIA, 28, null, null)
  ],
  [SpeciesId.BARBOACH]: [
    new SpeciesEvolution(SpeciesId.WHISCASH, 25, null, null)
  ],
  [SpeciesId.CORPHISH]: [
    new SpeciesEvolution(SpeciesId.CRAWDAUNT, 27, null, null)
  ],
  [SpeciesId.BALTOY]: [
    new SpeciesEvolution(SpeciesId.CLAYDOL, 28, null, null)
  ],
  [SpeciesId.LILEEP]: [
    new SpeciesEvolution(SpeciesId.CRADILY, 31, null, null)
  ],
  [SpeciesId.ANORITH]: [
    new SpeciesEvolution(SpeciesId.ARMALDO, 31, null, null)
  ],
  [SpeciesId.FEEBAS]: [
    new SpeciesEvolution(SpeciesId.MILOTIC, 21, null, null)
  ],
  [SpeciesId.SHUPPET]: [
    new SpeciesEvolution(SpeciesId.BANETTE, 26, null, null)
  ],
  [SpeciesId.DUSKULL]: [
    new SpeciesEvolution(SpeciesId.DUSCLOPS, 26, null, null)
  ],
  [SpeciesId.DUSCLOPS]: [
    new SpeciesEvolution(SpeciesId.DUSKNOIR, 40, null, null)
  ],
  [SpeciesId.WYNAUT]: [
    new SpeciesEvolution(SpeciesId.WOBBUFFET, 20, null, null)
  ],
  [SpeciesId.SNORUNT]: [
    new SpeciesEvolution(SpeciesId.FROSLASS, 27, null, {key: EvoCondKey.GENDER, gender: Gender.FEMALE}),
    new SpeciesEvolution(SpeciesId.GLALIE, 27, null, null)
  ],
  [SpeciesId.SPHEAL]: [
    new SpeciesEvolution(SpeciesId.SEALEO, 23, null, null)
  ],
  [SpeciesId.SEALEO]: [
    new SpeciesEvolution(SpeciesId.WALREIN, 38, null, null)
  ],
  [SpeciesId.CLAMPERL]: [
    new SpeciesEvolution(SpeciesId.HUNTAIL, 30, null, null),
    new SpeciesEvolution(SpeciesId.GOREBYSS, 30, null, null)
  ],
  [SpeciesId.BAGON]: [
    new SpeciesEvolution(SpeciesId.SHELGON, 24, null, null)
  ],
  [SpeciesId.SHELGON]: [
    new SpeciesEvolution(SpeciesId.SALAMENCE, 42, null, null)
  ],
  [SpeciesId.BELDUM]: [
    new SpeciesEvolution(SpeciesId.METANG, 24, null, null)
  ],
  [SpeciesId.METANG]: [
    new SpeciesEvolution(SpeciesId.METAGROSS, 42, null, null)
  ],
  [SpeciesId.TURTWIG]: [
    new SpeciesEvolution(SpeciesId.GROTLE, 23, null, null)
  ],
  [SpeciesId.GROTLE]: [
    new SpeciesEvolution(SpeciesId.TORTERRA, 37, null, null)
  ],
  [SpeciesId.CHIMCHAR]: [
    new SpeciesEvolution(SpeciesId.MONFERNO, 22, null, null)
  ],
  [SpeciesId.MONFERNO]: [
    new SpeciesEvolution(SpeciesId.INFERNAPE, 37, null, null)
  ],
  [SpeciesId.PIPLUP]: [
    new SpeciesEvolution(SpeciesId.PRINPLUP, 23, null, null)
  ],
  [SpeciesId.PRINPLUP]: [
    new SpeciesEvolution(SpeciesId.EMPOLEON, 37, null, null)
  ],
  [SpeciesId.STARLY]: [
    new SpeciesEvolution(SpeciesId.STARAVIA, 13, null, null)
  ],
  [SpeciesId.STARAVIA]: [
    new SpeciesEvolution(SpeciesId.STARAPTOR, 30, null, null)
  ],
  [SpeciesId.BIDOOF]: [
    new SpeciesEvolution(SpeciesId.BIBAREL, 20, null, null)
  ],
  [SpeciesId.KRICKETOT]: [
    new SpeciesEvolution(SpeciesId.KRICKETUNE, 11, null, null)
  ],
  [SpeciesId.SHINX]: [
    new SpeciesEvolution(SpeciesId.LUXIO, 15, null, null)
  ],
  [SpeciesId.LUXIO]: [
    new SpeciesEvolution(SpeciesId.LUXRAY, 34, null, null)
  ],
  [SpeciesId.BUDEW]: [
    new SpeciesEvolution(SpeciesId.ROSELIA, 22, null, null)
  ],
  [SpeciesId.ROSELIA]: [
    new SpeciesEvolution(SpeciesId.ROSERADE, 37, null, null)
  ],
  [SpeciesId.CRANIDOS]: [
    new SpeciesEvolution(SpeciesId.RAMPARDOS, 31, null, null)
  ],
  [SpeciesId.SHIELDON]: [
    new SpeciesEvolution(SpeciesId.BASTIODON, 31, null, null)
  ],
  [SpeciesId.BURMY]: [
    new SpeciesEvolution(SpeciesId.MOTHIM, 17, null, {key: EvoCondKey.GENDER, gender: Gender.MALE}),
    new SpeciesEvolution(SpeciesId.WORMADAM, 17, null, {key: EvoCondKey.GENDER, gender: Gender.FEMALE})
  ],
  [SpeciesId.COMBEE]: [
    new SpeciesEvolution(SpeciesId.VESPIQUEN, 21, null, {key: EvoCondKey.GENDER, gender: Gender.FEMALE})
  ],
  [SpeciesId.BUIZEL]: [
    new SpeciesEvolution(SpeciesId.FLOATZEL, 30, null, null)
  ],
  [SpeciesId.CHERUBI]: [
    new SpeciesEvolution(SpeciesId.CHERRIM, 24, null, null)
  ],
  [SpeciesId.SHELLOS]: [
    new SpeciesEvolution(SpeciesId.GASTRODON, 28, null, null)
  ],
  [SpeciesId.DRIFLOON]: [
    new SpeciesEvolution(SpeciesId.DRIFBLIM, 30, null, null)
  ],
  [SpeciesId.BUNEARY]: [
    new SpeciesEvolution(SpeciesId.LOPUNNY, 31, null, null)
  ],
  [SpeciesId.GLAMEOW]: [
    new SpeciesEvolution(SpeciesId.PURUGLY, 27, null, null)
  ],
  [SpeciesId.CHINGLING]: [
    new SpeciesEvolution(SpeciesId.CHIMECHO, 25, null, null)
  ],
  [SpeciesId.STUNKY]: [
    new SpeciesEvolution(SpeciesId.SKUNTANK, 28, null, null)
  ],
  [SpeciesId.BRONZOR]: [
    new SpeciesEvolution(SpeciesId.BRONZONG, 28, null, null)
  ],
  [SpeciesId.BONSLY]: [
    new SpeciesEvolution(SpeciesId.SUDOWOODO, 23, null, null)
  ],
  [SpeciesId.MIME_JR]: [
    new SpeciesEvolution(SpeciesId.MR_MIME, 27, null, null),
    new SpeciesEvolution(SpeciesId.GALAR_MR_MIME, 27, null, null)
  ],
  [SpeciesId.GALAR_MR_MIME]: [
    new SpeciesEvolution(SpeciesId.MR_RIME, 41, null, null)
  ],
  [ SpeciesId.HAPPINY]: [
    new SpeciesEvolution(SpeciesId.CHANSEY, 19, null, null)
  ],
  [SpeciesId.CHANSEY]: [
    new SpeciesEvolution(SpeciesId.BLISSEY, 40, null, null)
  ],
  [SpeciesId.GIBLE]: [
    new SpeciesEvolution(SpeciesId.GABITE, 24, null, null)
  ],
  [SpeciesId.GABITE]: [
    new SpeciesEvolution(SpeciesId.GARCHOMP, 41, null, null)
  ],
  [SpeciesId.MUNCHLAX]: [
    new SpeciesEvolution(SpeciesId.SNORLAX, 36, null, null)
  ],
  [SpeciesId.RIOLU]: [
    new SpeciesEvolution(SpeciesId.LUCARIO, 26, null, null)
  ],
  [SpeciesId.HIPPOPOTAS]: [
    new SpeciesEvolution(SpeciesId.HIPPOWDON, 31, null, null)
  ],
  [SpeciesId.SKORUPI]: [
    new SpeciesEvolution(SpeciesId.DRAPION, 31, null, null)
  ],
  [SpeciesId.CROAGUNK]: [
    new SpeciesEvolution(SpeciesId.TOXICROAK, 27, null, null)
  ],
  [SpeciesId.FINNEON]: [
    new SpeciesEvolution(SpeciesId.LUMINEON, 29, null, null)
  ],
  [SpeciesId.MANTYKE]: [
    new SpeciesEvolution(SpeciesId.MANTINE, 30, null, null)
  ],
  [SpeciesId.SNOVER]: [
    new SpeciesEvolution(SpeciesId.ABOMASNOW, 30, null, null)
  ],
  [SpeciesId.SNIVY]: [
    new SpeciesEvolution(SpeciesId.SERVINE, 24, null, null)
  ],
  [SpeciesId.SERVINE]: [
    new SpeciesEvolution(SpeciesId.SERPERIOR, 38, null, null)
  ],
  [SpeciesId.TEPIG]: [
    new SpeciesEvolution(SpeciesId.PIGNITE, 24, null, null)
  ],
  [SpeciesId.PIGNITE]: [
    new SpeciesEvolution(SpeciesId.EMBOAR, 38, null, null)
  ],
  [SpeciesId.OSHAWOTT]: [
    new SpeciesEvolution(SpeciesId.DEWOTT, 24, null, null)
  ],
  [SpeciesId.DEWOTT]: [
    new SpeciesEvolution(SpeciesId.SAMUROTT, 38, null, null),
    new SpeciesEvolution(SpeciesId.HISUI_SAMUROTT, 38, null, null),
  ],
  [SpeciesId.PATRAT]: [
    new SpeciesEvolution(SpeciesId.WATCHOG, 20, null, null)
  ],
  [SpeciesId.LILLIPUP]: [
    new SpeciesEvolution(SpeciesId.HERDIER, 16, null, null)
  ],
  [SpeciesId.HERDIER]: [
    new SpeciesEvolution(SpeciesId.STOUTLAND, 34, null, null)
  ],
  [SpeciesId.PURRLOIN]: [
    new SpeciesEvolution(SpeciesId.LIEPARD, 23, null, null)
  ],
  [SpeciesId.PANSAGE]: [
    new SpeciesEvolution(SpeciesId.SIMISAGE, 28, null, null)
  ],
  [SpeciesId.PANSEAR]: [
    new SpeciesEvolution(SpeciesId.SIMISEAR, 28, null, null)
  ],
  [SpeciesId.PANPOUR]: [
    new SpeciesEvolution(SpeciesId.SIMIPOUR, 28, null, null)
  ],
  [SpeciesId.MUNNA]: [
    new SpeciesEvolution(SpeciesId.MUSHARNA, 26, null, null)
  ],
  [SpeciesId.PIDOVE]: [
    new SpeciesEvolution(SpeciesId.TRANQUILL, 15, null, null)
  ],
  [SpeciesId.TRANQUILL]: [
    new SpeciesEvolution(SpeciesId.UNFEZANT, 31, null, null)
  ],
  [SpeciesId.BLITZLE]: [
    new SpeciesEvolution(SpeciesId.ZEBSTRIKA, 26, null, null)
  ],
  [SpeciesId.ROGGENROLA]: [
    new SpeciesEvolution(SpeciesId.BOLDORE, 19, null, null)
  ],
  [SpeciesId.BOLDORE]: [
    new SpeciesEvolution(SpeciesId.GIGALITH, 36, null, null)
  ],
  [SpeciesId.WOOBAT]: [
    new SpeciesEvolution(SpeciesId.SWOOBAT, 26, null, null)
  ],
  [SpeciesId.DRILBUR]: [
    new SpeciesEvolution(SpeciesId.EXCADRILL, 30, null, null)
  ],
  [SpeciesId.TIMBURR]: [
    new SpeciesEvolution(SpeciesId.GURDURR, 22, null, null)
  ],
  [SpeciesId.GURDURR]: [
    new SpeciesEvolution(SpeciesId.CONKELDURR, 35, null, null)
  ],
  [SpeciesId.TYMPOLE]: [
    new SpeciesEvolution(SpeciesId.PALPITOAD, 18, null, null)
  ],
  [SpeciesId.PALPITOAD]: [
    new SpeciesEvolution(SpeciesId.SEISMITOAD, 35, null, null)
  ],
  [SpeciesId.SEWADDLE]: [
    new SpeciesEvolution(SpeciesId.SWADLOON, 20, null, null)
  ],
  [SpeciesId.SWADLOON]: [
    new SpeciesEvolution(SpeciesId.LEAVANNY, 35, null, null)
  ],
  [SpeciesId.VENIPEDE]: [
    new SpeciesEvolution(SpeciesId.WHIRLIPEDE, 15, null, null)
  ],
  [SpeciesId.WHIRLIPEDE]: [
    new SpeciesEvolution(SpeciesId.SCOLIPEDE, 32, null, null)
  ],
  [SpeciesId.COTTONEE]: [
    new SpeciesEvolution(SpeciesId.WHIMSICOTT, 25, null, null)
  ],
  [SpeciesId.PETILIL]: [
    new SpeciesEvolution(SpeciesId.LILLIGANT, 25, null, null),
    new SpeciesEvolution(SpeciesId.HISUI_LILLIGANT, 25, null, null)
  ],
  [SpeciesId.BASCULIN]: [
    new SpeciesFormEvolution(SpeciesId.BASCULEGION, "white-striped", "female", 41, null, [{key: EvoCondKey.GENDER, gender: Gender.FEMALE}]),
    new SpeciesFormEvolution(SpeciesId.BASCULEGION, "white-striped", "male", 41, null, [{key: EvoCondKey.GENDER, gender: Gender.MALE}])
  ],
  [SpeciesId.SANDILE]: [
    new SpeciesEvolution(SpeciesId.KROKOROK, 18, null, null)
  ],
  [SpeciesId.KROKOROK]: [
    new SpeciesEvolution(SpeciesId.KROOKODILE, 33, null, null)
  ],
  [SpeciesId.DARUMAKA]: [
    new SpeciesEvolution(SpeciesId.DARMANITAN, 28, null, null)
  ],
  [SpeciesId.DWEBBLE]: [
    new SpeciesEvolution(SpeciesId.CRUSTLE, 29, null, null)
  ],
  [SpeciesId.SCRAGGY]: [
    new SpeciesEvolution(SpeciesId.SCRAFTY, 30, null, null)
  ],
  [SpeciesId.YAMASK]: [
    new SpeciesEvolution(SpeciesId.COFAGRIGUS, 28, null, null)
  ],
  [SpeciesId.TIRTOUGA]: [
    new SpeciesEvolution(SpeciesId.CARRACOSTA, 31, null, null)
  ],
  [SpeciesId.ARCHEN]: [
    new SpeciesEvolution(SpeciesId.ARCHEOPS, 40, null, null)
  ],
  [SpeciesId.TRUBBISH]: [
    new SpeciesEvolution(SpeciesId.GARBODOR, 28, null, null)
  ],
  [SpeciesId.ZORUA]: [
    new SpeciesEvolution(SpeciesId.ZOROARK, 31, null, null)
  ],
  [SpeciesId.MINCCINO]: [
    new SpeciesEvolution(SpeciesId.CINCCINO, 27, null, null)
  ],
  [SpeciesId.GOTHITA]: [
    new SpeciesEvolution(SpeciesId.GOTHORITA, 18, null, null)
  ],
  [SpeciesId.GOTHORITA]: [
    new SpeciesEvolution(SpeciesId.GOTHITELLE, 33, null, null)
  ],
  [SpeciesId.SOLOSIS]: [
    new SpeciesEvolution(SpeciesId.DUOSION, 18, null, null)
  ],
  [SpeciesId.DUOSION]: [
    new SpeciesEvolution(SpeciesId.REUNICLUS, 33, null, null)
  ],
  [SpeciesId.DUCKLETT]: [
    new SpeciesEvolution(SpeciesId.SWANNA, 27, null, null)
  ],
  [SpeciesId.VANILLITE]: [
    new SpeciesEvolution(SpeciesId.VANILLISH, 19, null, null)
  ],
  [SpeciesId.VANILLISH]: [
    new SpeciesEvolution(SpeciesId.VANILLUXE, 36, null, null)
  ],
  [SpeciesId.DEERLING]: [
    new SpeciesEvolution(SpeciesId.SAWSBUCK, 29, null, null)
  ],
  [SpeciesId.KARRABLAST]: [
    new SpeciesEvolution(SpeciesId.ESCAVALIER, 28, null, null)
  ],
  [SpeciesId.FOONGUS]: [
    new SpeciesEvolution(SpeciesId.AMOONGUSS, 26, null, null)
  ],
  [SpeciesId.FRILLISH]: [
    new SpeciesEvolution(SpeciesId.JELLICENT, 29, null, null)
  ],
  [SpeciesId.JOLTIK]: [
    new SpeciesEvolution(SpeciesId.GALVANTULA, 28, null, null)
  ],
  [SpeciesId.FERROSEED]: [
    new SpeciesEvolution(SpeciesId.FERROTHORN, 27, null, null)
  ],
  [SpeciesId.KLINK]: [
    new SpeciesEvolution(SpeciesId.KLANG, 24, null, null)
  ],
  [SpeciesId.KLANG]: [
    new SpeciesEvolution(SpeciesId.KLINKLANG, 39, null, null)
  ],
  [SpeciesId.TYNAMO]: [
    new SpeciesEvolution(SpeciesId.EELEKTRIK, 21, null, null)
  ],
  [SpeciesId.EELEKTRIK]: [
    new SpeciesEvolution(SpeciesId.EELEKTROSS, 37, null, null)
  ],
  [SpeciesId.ELGYEM]: [
    new SpeciesEvolution(SpeciesId.BEHEEYEM, 29, null, null)
  ],
  [SpeciesId.LITWICK]: [
    new SpeciesEvolution(SpeciesId.LAMPENT, 16, null, null)
  ],
  [SpeciesId.LAMPENT]: [
    new SpeciesEvolution(SpeciesId.CHANDELURE, 34, null, null)
  ],
  [SpeciesId.AXEW]: [
    new SpeciesEvolution(SpeciesId.FRAXURE, 24, null, null)
  ],
  [SpeciesId.FRAXURE]: [
    new SpeciesEvolution(SpeciesId.HAXORUS, 38, null, null)
  ],
  [SpeciesId.CUBCHOO]: [
    new SpeciesEvolution(SpeciesId.BEARTIC, 28, null, null)
  ],
  [SpeciesId.SHELMET]: [
    new SpeciesEvolution(SpeciesId.ACCELGOR, 27, null, null)
  ],
  [SpeciesId.MIENFOO]: [
    new SpeciesEvolution(SpeciesId.MIENSHAO, 33, null, null)
  ],
  [SpeciesId.GOLETT]: [
    new SpeciesEvolution(SpeciesId.GOLURK, 27, null, null)
  ],
  [SpeciesId.PAWNIARD]: [
    new SpeciesEvolution(SpeciesId.BISHARP, 30, null, null)
  ],
  [SpeciesId.BISHARP]: [
    new SpeciesEvolution(SpeciesId.KINGAMBIT, 46, null, null)
  ],
  [SpeciesId.RUFFLET]: [
    new SpeciesEvolution(SpeciesId.HISUI_BRAVIARY, 33, null, null),
    new SpeciesEvolution(SpeciesId.BRAVIARY, 33, null, null)
  ],
  [SpeciesId.VULLABY]: [
    new SpeciesEvolution(SpeciesId.MANDIBUZZ, 34, null, null)
  ],
  [SpeciesId.DEINO]: [
    new SpeciesEvolution(SpeciesId.ZWEILOUS, 24, null, null)
  ],
  [SpeciesId.ZWEILOUS]: [
    new SpeciesEvolution(SpeciesId.HYDREIGON, 42, null, null)
  ],
  [SpeciesId.LARVESTA]: [
    new SpeciesEvolution(SpeciesId.VOLCARONA, 36, null, null)
  ],
  [SpeciesId.CHESPIN]: [
    new SpeciesEvolution(SpeciesId.QUILLADIN, 23, null, null)
  ],
  [SpeciesId.QUILLADIN]: [
    new SpeciesEvolution(SpeciesId.CHESNAUGHT, 37, null, null)
  ],
  [SpeciesId.FENNEKIN]: [
    new SpeciesEvolution(SpeciesId.BRAIXEN, 24, null, null)
  ],
  [SpeciesId.BRAIXEN]: [
    new SpeciesEvolution(SpeciesId.DELPHOX, 37, null, null)
  ],
  [SpeciesId.FROAKIE]: [
    new SpeciesEvolution(SpeciesId.FROGADIER, 23, null, null)
  ],
  [SpeciesId.FROGADIER]: [
    new SpeciesEvolution(SpeciesId.GRENINJA, 37, null, null)
  ],
  [SpeciesId.BUNNELBY]: [
    new SpeciesEvolution(SpeciesId.DIGGERSBY, 18, null, null)
  ],
  [SpeciesId.FLETCHLING]: [
    new SpeciesEvolution(SpeciesId.FLETCHINDER, 18, null, null)
  ],
  [SpeciesId.FLETCHINDER]: [
    new SpeciesEvolution(SpeciesId.TALONFLAME, 34, null, null)
  ],
  [SpeciesId.SCATTERBUG]: [
    new SpeciesEvolution(SpeciesId.SPEWPA, 7, null, null)
  ],
  [SpeciesId.SPEWPA]: [
    new SpeciesEvolution(SpeciesId.VIVILLON, 16, null, null)
  ],
  [SpeciesId.LITLEO]: [
    new SpeciesEvolution(SpeciesId.PYROAR, 33, null, null)
  ],
  [SpeciesId.FLABEBE]: [
    new SpeciesEvolution(SpeciesId.FLOETTE, 19, null, null)
  ],
  [SpeciesId.FLOETTE]: [
    new SpeciesEvolution(SpeciesId.FLORGES, 37, null, null)
  ],
  [SpeciesId.SKIDDO]: [
    new SpeciesEvolution(SpeciesId.GOGOAT, 33, null, null)
  ],
  [SpeciesId.PANCHAM]: [
    new SpeciesEvolution(SpeciesId.PANGORO, 30, null, null)
  ],
  [SpeciesId.ESPURR]: [
    new SpeciesFormEvolution(SpeciesId.MEOWSTIC, "", "female", 31, null, {key: EvoCondKey.GENDER, gender: Gender.FEMALE}),
    new SpeciesFormEvolution(SpeciesId.MEOWSTIC, "", "", 31, null, {key: EvoCondKey.GENDER, gender: Gender.MALE})
  ],
  [SpeciesId.HONEDGE]: [
    new SpeciesEvolution(SpeciesId.DOUBLADE, 26, null, null)
  ],
  [SpeciesId.DOUBLADE]: [
    new SpeciesEvolution(SpeciesId.AEGISLASH, 39, null, null)
  ],
  [SpeciesId.SPRITZEE]: [
    new SpeciesEvolution(SpeciesId.AROMATISSE, 30, null, null)
  ],
  [SpeciesId.SWIRLIX]: [
    new SpeciesEvolution(SpeciesId.SLURPUFF, 30, null, null)
  ],
  [SpeciesId.INKAY]: [
    new SpeciesEvolution(SpeciesId.MALAMAR, 25, null, null)
  ],
  [SpeciesId.BINACLE]: [
    new SpeciesEvolution(SpeciesId.BARBARACLE, 28, null, null)
  ],
  [SpeciesId.SKRELP]: [
    new SpeciesEvolution(SpeciesId.DRAGALGE, 29, null, null)
  ],
  [SpeciesId.CLAUNCHER]: [
    new SpeciesEvolution(SpeciesId.CLAWITZER, 31, null, null)
  ],
  [SpeciesId.HELIOPTILE]: [
    new SpeciesEvolution(SpeciesId.HELIOLISK, 25, null, null)
  ],
  [SpeciesId.TYRUNT]: [
    new SpeciesEvolution(SpeciesId.TYRANTRUM, 34, null, null)
  ],
  [SpeciesId.AMAURA]: [
    new SpeciesEvolution(SpeciesId.AURORUS, 34, null, null)
  ],
  [SpeciesId.GOOMY]: [
    new SpeciesEvolution(SpeciesId.HISUI_SLIGGOO, 27, null, null),
    new SpeciesEvolution(SpeciesId.SLIGGOO, 27, null, null)
  ],
  [SpeciesId.SLIGGOO]: [
    new SpeciesEvolution(SpeciesId.GOODRA, 44, null, null)
  ],
  [SpeciesId.HISUI_SLIGGOO]: [
    new SpeciesEvolution(SpeciesId.HISUI_GOODRA, 44, null, null)
  ],
  [SpeciesId.PHANTUMP]: [
    new SpeciesEvolution(SpeciesId.TREVENANT, 27, null, null)
  ],
  [SpeciesId.PUMPKABOO]: [
    new SpeciesEvolution(SpeciesId.GOURGEIST, 30, null, null)
  ],
  [SpeciesId.BERGMITE]: [
    new SpeciesEvolution(SpeciesId.HISUI_AVALUGG, 28, null, null),
    new SpeciesEvolution(SpeciesId.AVALUGG, 28, null, null)
  ],
  [SpeciesId.NOIBAT]: [
    new SpeciesEvolution(SpeciesId.NOIVERN, 25, null, null)
  ],
  [SpeciesId.ROWLET]: [
    new SpeciesEvolution(SpeciesId.DARTRIX, 24, null, null)
  ],
  [SpeciesId.DARTRIX]: [
    new SpeciesEvolution(SpeciesId.HISUI_DECIDUEYE, 39, null, null),
    new SpeciesEvolution(SpeciesId.DECIDUEYE, 39, null, null)
  ],
  [SpeciesId.LITTEN]: [
    new SpeciesEvolution(SpeciesId.TORRACAT, 24, null, null)
  ],
  [SpeciesId.TORRACAT]: [
    new SpeciesEvolution(SpeciesId.INCINEROAR, 39, null, null)
  ],
  [SpeciesId.POPPLIO]: [
    new SpeciesEvolution(SpeciesId.BRIONNE, 24, null, null)
  ],
  [SpeciesId.BRIONNE]: [
    new SpeciesEvolution(SpeciesId.PRIMARINA, 39, null, null)
  ],
  [SpeciesId.PIKIPEK]: [
    new SpeciesEvolution(SpeciesId.TRUMBEAK, 15, null, null)
  ],
  [SpeciesId.TRUMBEAK]: [
    new SpeciesEvolution(SpeciesId.TOUCANNON, 31, null, null)
  ],
  [SpeciesId.YUNGOOS]: [
    new SpeciesEvolution(SpeciesId.GUMSHOOS, 20, null, null)
  ],
  [SpeciesId.GRUBBIN]: [
    new SpeciesEvolution(SpeciesId.CHARJABUG, 22, null, null)
  ],
  [SpeciesId.CHARJABUG]: [
    new SpeciesEvolution(SpeciesId.VIKAVOLT, 35, null, null)
  ],
  [SpeciesId.CRABRAWLER]: [
    new SpeciesEvolution(SpeciesId.CRABOMINABLE, 29, null, null)
  ],
  [SpeciesId.CUTIEFLY]: [
    new SpeciesEvolution(SpeciesId.RIBOMBEE, 27, null, null)
  ],
  [SpeciesId.ROCKRUFF]: [
    new SpeciesFormEvolution(SpeciesId.LYCANROC, "", "midday", 25, null, null),
    new SpeciesFormEvolution(SpeciesId.LYCANROC, "", "midnight", 25, null, null),
    new SpeciesFormEvolution(SpeciesId.LYCANROC, "own-tempo", "dusk", 25, null, null)
  ],
  [SpeciesId.MAREANIE]: [
    new SpeciesEvolution(SpeciesId.TOXAPEX, 27, null, null)
  ],
  [SpeciesId.MUDBRAY]: [
    new SpeciesEvolution(SpeciesId.MUDSDALE, 35, null, null)
  ],
  [SpeciesId.DEWPIDER]: [
    new SpeciesEvolution(SpeciesId.ARAQUANID, 23, null, null)
  ],
  [SpeciesId.FOMANTIS]: [
    new SpeciesEvolution(SpeciesId.LURANTIS, 22, null, null)
  ],
  [SpeciesId.MORELULL]: [
    new SpeciesEvolution(SpeciesId.SHIINOTIC, 22, null, null)
  ],
  [SpeciesId.SALANDIT]: [
    new SpeciesEvolution(SpeciesId.SALAZZLE, 29, null, {key: EvoCondKey.GENDER, gender: Gender.FEMALE})
  ],
  [SpeciesId.STUFFUL]: [
    new SpeciesEvolution(SpeciesId.BEWEAR, 32, null, null)
  ],
  [SpeciesId.BOUNSWEET]: [
    new SpeciesEvolution(SpeciesId.STEENEE, 8, null, null)
  ],
  [SpeciesId.STEENEE]: [
    new SpeciesEvolution(SpeciesId.TSAREENA, 27, null, null)
  ],
  [SpeciesId.WIMPOD]: [
    new SpeciesEvolution(SpeciesId.GOLISOPOD, 24, null, null)
  ],
  [SpeciesId.SANDYGAST]: [
    new SpeciesEvolution(SpeciesId.PALOSSAND, 29, null, null)
  ],
  [SpeciesId.TYPE_NULL]: [
    new SpeciesEvolution(SpeciesId.SILVALLY, 48, null, null)
  ],
  [SpeciesId.JANGMO_O]: [
    new SpeciesEvolution(SpeciesId.HAKAMO_O, 24, null, null)
  ],
  [SpeciesId.HAKAMO_O]: [
    new SpeciesEvolution(SpeciesId.KOMMO_O, 42, null, null)
  ],
  [SpeciesId.COSMOG]: [
    new SpeciesEvolution(SpeciesId.COSMOEM, 15, null, null)
  ],
  [SpeciesId.COSMOEM]: [
    new SpeciesEvolution(SpeciesId.SOLGALEO, 43, null, null),
    new SpeciesEvolution(SpeciesId.LUNALA, 43, null, null)
  ],
  [SpeciesId.POIPOLE]: [
    new SpeciesEvolution(SpeciesId.NAGANADEL, 39, null, null)
  ],
  [SpeciesId.MELTAN]: [
    new SpeciesEvolution(SpeciesId.MELMETAL, 33, null, null)
  ],
  [SpeciesId.ALOLA_RATTATA]: [
    new SpeciesEvolution(SpeciesId.ALOLA_RATICATE, 20, null, null)
  ],
  [SpeciesId.ALOLA_SANDSHREW]: [
    new SpeciesEvolution(SpeciesId.ALOLA_SANDSLASH, 26, null, null)
  ],
  [SpeciesId.ALOLA_VULPIX]: [
    new SpeciesEvolution(SpeciesId.ALOLA_NINETALES, 27, null, null)
  ],
  [SpeciesId.ALOLA_DIGLETT]: [
    new SpeciesEvolution(SpeciesId.ALOLA_DUGTRIO, 21, null, null)
  ],
  [SpeciesId.ALOLA_MEOWTH]: [
    new SpeciesEvolution(SpeciesId.ALOLA_PERSIAN, 23, null, null)
  ],
  [SpeciesId.ALOLA_GEODUDE]: [
    new SpeciesEvolution(SpeciesId.ALOLA_GRAVELER, 19, null, null)
  ],
  [SpeciesId.ALOLA_GRAVELER]: [
    new SpeciesEvolution(SpeciesId.ALOLA_GOLEM, 35, null, null)
  ],
  [SpeciesId.ALOLA_GRIMER]: [
    new SpeciesEvolution(SpeciesId.ALOLA_MUK, 30, null, null)
  ],
  [SpeciesId.GROOKEY]: [
    new SpeciesEvolution(SpeciesId.THWACKEY, 25, null, null)
  ],
  [SpeciesId.THWACKEY]: [
    new SpeciesEvolution(SpeciesId.RILLABOOM, 39, null, null)
  ],
  [SpeciesId.SCORBUNNY]: [
    new SpeciesEvolution(SpeciesId.RABOOT, 25, null, null)
  ],
  [SpeciesId.RABOOT]: [
    new SpeciesEvolution(SpeciesId.CINDERACE, 39, null, null)
  ],
  [SpeciesId.SOBBLE]: [
    new SpeciesEvolution(SpeciesId.DRIZZILE, 25, null, null)
  ],
  [SpeciesId.DRIZZILE]: [
    new SpeciesEvolution(SpeciesId.INTELEON, 39, null, null)
  ],
  [SpeciesId.SKWOVET]: [
    new SpeciesEvolution(SpeciesId.GREEDENT, 24, null, null)
  ],
  [SpeciesId.ROOKIDEE]: [
    new SpeciesEvolution(SpeciesId.CORVISQUIRE, 15, null, null)
  ],
  [SpeciesId.CORVISQUIRE]: [
    new SpeciesEvolution(SpeciesId.CORVIKNIGHT, 32, null, null)
  ],
  [SpeciesId.BLIPBUG]: [
    new SpeciesEvolution(SpeciesId.DOTTLER, 10, null, null)
  ],
  [SpeciesId.DOTTLER]: [
    new SpeciesEvolution(SpeciesId.ORBEETLE, 31, null, null)
  ],
  [SpeciesId.NICKIT]: [
    new SpeciesEvolution(SpeciesId.THIEVUL, 21, null, null)
  ],
  [SpeciesId.GOSSIFLEUR]: [
    new SpeciesEvolution(SpeciesId.ELDEGOSS, 22, null, null)
  ],
  [SpeciesId.WOOLOO]: [
    new SpeciesEvolution(SpeciesId.DUBWOOL, 24, null, null)
  ],
  [SpeciesId.CHEWTLE]: [
    new SpeciesEvolution(SpeciesId.DREDNAW, 25, null, null)
  ],
  [SpeciesId.YAMPER]: [
    new SpeciesEvolution(SpeciesId.BOLTUND, 24, null, null)
  ],
  [SpeciesId.ROLYCOLY]: [
    new SpeciesEvolution(SpeciesId.CARKOL, 19, null, null)
  ],
  [SpeciesId.CARKOL]: [
    new SpeciesEvolution(SpeciesId.COALOSSAL, 36, null, null)
  ],
  [SpeciesId.APPLIN]: [
    new SpeciesEvolution(SpeciesId.FLAPPLE, 23, null, null),
    new SpeciesEvolution(SpeciesId.APPLETUN, 23, null, null),
    new SpeciesEvolution(SpeciesId.DIPPLIN, 23, null, null),
  ],
  [SpeciesId.DIPPLIN]: [
    new SpeciesEvolution(SpeciesId.HYDRAPPLE, 43, null, null)
  ],
  [SpeciesId.SILICOBRA]: [
    new SpeciesEvolution(SpeciesId.SANDACONDA, 29, null, null)
  ],
  [SpeciesId.ARROKUDA]: [
    new SpeciesEvolution(SpeciesId.BARRASKEWDA, 25, null, null)
  ],
  [SpeciesId.TOXEL]: [
    new SpeciesFormEvolution(SpeciesId.TOXTRICITY, "", "lowkey", 25, null,
      {key: EvoCondKey.NATURE, nature: [ Nature.LONELY, Nature.BOLD, Nature.RELAXED, Nature.TIMID, Nature.SERIOUS, Nature.MODEST, Nature.MILD, Nature.QUIET, Nature.BASHFUL, Nature.CALM, Nature.GENTLE, Nature.CAREFUL ]}
    ),
    new SpeciesFormEvolution(SpeciesId.TOXTRICITY, "", "amped", 25, null, null)
  ],
  [SpeciesId.SIZZLIPEDE]: [
    new SpeciesEvolution(SpeciesId.CENTISKORCH, 28, null, null)
  ],
  [SpeciesId.CLOBBOPUS]: [
    new SpeciesEvolution(SpeciesId.GRAPPLOCT, 28, null, null)
  ],
  [SpeciesId.SINISTEA]: [
    new SpeciesFormEvolution(SpeciesId.POLTEAGEIST, "phony", "phony", 28, null, null),
    new SpeciesFormEvolution(SpeciesId.POLTEAGEIST, "antique", "antique", 28, null, null)
  ],
  [SpeciesId.HATENNA]: [
    new SpeciesEvolution(SpeciesId.HATTREM, 17, null, null)
  ],
  [SpeciesId.HATTREM]: [
    new SpeciesEvolution(SpeciesId.HATTERENE, 34, null, null)
  ],
  [SpeciesId.IMPIDIMP]: [
    new SpeciesEvolution(SpeciesId.MORGREM, 17, null, null)
  ],
  [SpeciesId.MORGREM]: [
    new SpeciesEvolution(SpeciesId.GRIMMSNARL, 34, null, null)
  ],
  [SpeciesId.MILCERY]: [
    new SpeciesFormEvolution(SpeciesId.ALCREMIE, "", "vanilla-cream", 24, null,
      {key: EvoCondKey.BIOME, biome: [ BiomeId.TOWN, BiomeId.PLAINS, BiomeId.GRASS, BiomeId.TALL_GRASS, BiomeId.METROPOLIS ]}),
    new SpeciesFormEvolution(SpeciesId.ALCREMIE, "", "ruby-cream", 24, null,
      {key: EvoCondKey.BIOME, biome: [ BiomeId.BADLANDS, BiomeId.VOLCANO, BiomeId.GRAVEYARD, BiomeId.FACTORY, BiomeId.SLUM ]}),
    new SpeciesFormEvolution(SpeciesId.ALCREMIE, "", "matcha-cream", 24, null,
      {key: EvoCondKey.BIOME, biome: [ BiomeId.FOREST, BiomeId.SWAMP, BiomeId.MEADOW, BiomeId.JUNGLE ]}),
    new SpeciesFormEvolution(SpeciesId.ALCREMIE, "", "mint-cream", 24, null,
      {key: EvoCondKey.BIOME, biome: [ BiomeId.SEA, BiomeId.BEACH, BiomeId.LAKE, BiomeId.SEABED ]}),
    new SpeciesFormEvolution(SpeciesId.ALCREMIE, "", "lemon-cream", 24, null,
      {key: EvoCondKey.BIOME, biome: [ BiomeId.DESERT, BiomeId.POWER_PLANT, BiomeId.DOJO, BiomeId.RUINS, BiomeId.CONSTRUCTION_SITE ]}),
    new SpeciesFormEvolution(SpeciesId.ALCREMIE, "", "salted-cream", 24, null,
      {key: EvoCondKey.BIOME, biome: [ BiomeId.MOUNTAIN, BiomeId.CAVE, BiomeId.ICE_CAVE, BiomeId.FAIRY_CAVE, BiomeId.SNOWY_FOREST ]}),
    new SpeciesFormEvolution(SpeciesId.ALCREMIE, "", "ruby-swirl", 24, null,
      {key: EvoCondKey.BIOME, biome: [ BiomeId.WASTELAND, BiomeId.LABORATORY ]}),
    new SpeciesFormEvolution(SpeciesId.ALCREMIE, "", "caramel-swirl", 24, null,
      {key: EvoCondKey.BIOME, biome: [ BiomeId.TEMPLE, BiomeId.ISLAND ]}),
    new SpeciesFormEvolution(SpeciesId.ALCREMIE, "", "rainbow-swirl", 24, null,
      {key: EvoCondKey.BIOME, biome: [ BiomeId.ABYSS, BiomeId.SPACE, BiomeId.END ]})
  ],
  [SpeciesId.SNOM]: [
    new SpeciesEvolution(SpeciesId.FROSMOTH, 18, null, null)
  ],
  [SpeciesId.CUFANT]: [
    new SpeciesEvolution(SpeciesId.COPPERAJAH, 31, null, null)
  ],
  [SpeciesId.DURALUDON]: [
    new SpeciesFormEvolution(SpeciesId.ARCHALUDON, "", "", 50, null, null)
  ],
  [SpeciesId.DREEPY]: [
    new SpeciesEvolution(SpeciesId.DRAKLOAK, 21, null, null)
  ],
  [SpeciesId.DRAKLOAK]: [
    new SpeciesEvolution(SpeciesId.DRAGAPULT, 41, null, null)
  ],
  [SpeciesId.KUBFU]: [
    new SpeciesFormEvolution(SpeciesId.URSHIFU, "", "rapid-strike", 38, null, null),
    new SpeciesFormEvolution(SpeciesId.URSHIFU, "", "single-strike", 38, null, null)
  ],
  [SpeciesId.GALAR_MEOWTH]: [
    new SpeciesEvolution(SpeciesId.PERRSERKER, 23, null, null)
  ],
  [SpeciesId.GALAR_PONYTA]: [
    new SpeciesEvolution(SpeciesId.GALAR_RAPIDASH, 36, null, null)
  ],
  [SpeciesId.GALAR_SLOWPOKE]: [
    new SpeciesEvolution(SpeciesId.GALAR_SLOWBRO, 28, null, null),
    new SpeciesEvolution(SpeciesId.GALAR_SLOWKING, 28, null, null),
  ],
  [SpeciesId.GALAR_FARFETCHD]: [
    new SpeciesEvolution(SpeciesId.SIRFETCHD, 34, null, null)
  ],
  [SpeciesId.GALAR_CORSOLA]: [
    new SpeciesEvolution(SpeciesId.CURSOLA, 36, null, null)
  ],
  [SpeciesId.GALAR_ZIGZAGOON]: [
    new SpeciesEvolution(SpeciesId.GALAR_LINOONE, 19, null, null)
  ],
  [SpeciesId.GALAR_LINOONE]: [
    new SpeciesEvolution(SpeciesId.OBSTAGOON, 37, null, null)
  ],
  [SpeciesId.GALAR_DARUMAKA]: [
    new SpeciesEvolution(SpeciesId.GALAR_DARMANITAN, 28, null, null)
  ],
  [SpeciesId.GALAR_YAMASK]: [
    new SpeciesEvolution(SpeciesId.RUNERIGUS, 27, null, null)
  ],
  [SpeciesId.HISUI_GROWLITHE]: [
    new SpeciesEvolution(SpeciesId.HISUI_ARCANINE, 35, null, null)
  ],
  [SpeciesId.HISUI_VOLTORB]: [
    new SpeciesEvolution(SpeciesId.HISUI_ELECTRODE, 30, null, null)
  ],
  [SpeciesId.HISUI_QWILFISH]: [
    new SpeciesEvolution(SpeciesId.OVERQWIL, 39, null, null)
  ],
  [SpeciesId.HISUI_SNEASEL]: [
    new SpeciesEvolution(SpeciesId.SNEASLER, 38, null, null)
  ],
  [SpeciesId.HISUI_ZORUA]: [
    new SpeciesEvolution(SpeciesId.HISUI_ZOROARK, 31, null, null)
  ],
  [SpeciesId.SPRIGATITO]: [
    new SpeciesEvolution(SpeciesId.FLORAGATO, 23, null, null)
  ],
  [SpeciesId.FLORAGATO]: [
    new SpeciesEvolution(SpeciesId.MEOWSCARADA, 38, null, null)
  ],
  [SpeciesId.FUECOCO]: [
    new SpeciesEvolution(SpeciesId.CROCALOR, 23, null, null)
  ],
  [SpeciesId.CROCALOR]: [
    new SpeciesEvolution(SpeciesId.SKELEDIRGE, 38, null, null)
  ],
  [SpeciesId.QUAXLY]: [
    new SpeciesEvolution(SpeciesId.QUAXWELL, 23, null, null)
  ],
  [SpeciesId.QUAXWELL]: [
    new SpeciesEvolution(SpeciesId.QUAQUAVAL, 38, null, null)
  ],
  [SpeciesId.LECHONK]: [
    new SpeciesFormEvolution(SpeciesId.OINKOLOGNE, "", "female", 22, null, {key: EvoCondKey.GENDER, gender: Gender.FEMALE}),
    new SpeciesFormEvolution(SpeciesId.OINKOLOGNE, "", "", 22, null, {key: EvoCondKey.GENDER, gender: Gender.MALE})
  ],
  [SpeciesId.TAROUNTULA]: [
    new SpeciesEvolution(SpeciesId.SPIDOPS, 16, null, null)
  ],
  [SpeciesId.NYMBLE]: [
    new SpeciesEvolution(SpeciesId.LOKIX, 18, null, null)
  ],
  [SpeciesId.PAWMI]: [
    new SpeciesEvolution(SpeciesId.PAWMO, 15, null, null)
  ],
  [SpeciesId.PAWMO]: [
    new SpeciesEvolution(SpeciesId.PAWMOT, 31, null, null)
  ],
  [SpeciesId.TANDEMAUS]: [
    new SpeciesFormEvolution(SpeciesId.MAUSHOLD, "", "three", 27, null, {key: EvoCondKey.RANDOM_FORM, value: 4}),
    new SpeciesFormEvolution(SpeciesId.MAUSHOLD, "", "four", 27, null, null)
  ],
  [SpeciesId.FIDOUGH]: [
    new SpeciesEvolution(SpeciesId.DACHSBUN, 28, null, null)
  ],
  [SpeciesId.SMOLIV]: [
    new SpeciesEvolution(SpeciesId.DOLLIV, 15, null, null)
  ],
  [SpeciesId.DOLLIV]: [
    new SpeciesEvolution(SpeciesId.ARBOLIVA, 33, null, null)
  ],
  [SpeciesId.NACLI]: [
    new SpeciesEvolution(SpeciesId.NACLSTACK, 17, null, null)
  ],
  [SpeciesId.NACLSTACK]: [
    new SpeciesEvolution(SpeciesId.GARGANACL, 32, null, null)
  ],
  [SpeciesId.CHARCADET]: [
    new SpeciesEvolution(SpeciesId.ARMAROUGE, 26, null, null),
    new SpeciesEvolution(SpeciesId.CERULEDGE, 26, null, null)
  ],
  [SpeciesId.TADBULB]: [
    new SpeciesEvolution(SpeciesId.BELLIBOLT, 24, null, null)
  ],
  [SpeciesId.WATTREL]: [
    new SpeciesEvolution(SpeciesId.KILOWATTREL, 25, null, null)
  ],
  [SpeciesId.MASCHIFF]: [
    new SpeciesEvolution(SpeciesId.MABOSSTIFF, 32, null, null)
  ],
  [SpeciesId.SHROODLE]: [
    new SpeciesEvolution(SpeciesId.GRAFAIAI, 26, null, null)
  ],
  [SpeciesId.BRAMBLIN]: [
    new SpeciesEvolution(SpeciesId.BRAMBLEGHAST, 24, null, null)
  ],
  [SpeciesId.TOEDSCOOL]: [
    new SpeciesEvolution(SpeciesId.TOEDSCRUEL, 31, null, null)
  ],
  [SpeciesId.CAPSAKID]: [
    new SpeciesEvolution(SpeciesId.SCOVILLAIN, 27, null, null)
  ],
  [SpeciesId.RELLOR]: [
    new SpeciesEvolution(SpeciesId.RABSCA, 24, null, null)
  ],
  [SpeciesId.FLITTLE]: [
    new SpeciesEvolution(SpeciesId.ESPATHRA, 22, null, null)
  ],
  [SpeciesId.TINKATINK]: [
    new SpeciesEvolution(SpeciesId.TINKATUFF, 18, null, null)
  ],
  [SpeciesId.TINKATUFF]: [
    new SpeciesEvolution(SpeciesId.TINKATON, 35, null, null)
  ],
  [SpeciesId.WIGLETT]: [
    new SpeciesEvolution(SpeciesId.WUGTRIO, 19, null, null)
  ],
  [SpeciesId.FINIZEN]: [
    new SpeciesEvolution(SpeciesId.PALAFIN, 1, null, null)
  ],
  [SpeciesId.VAROOM]: [
    new SpeciesEvolution(SpeciesId.REVAVROOM, 28, null, null)
  ],
  [SpeciesId.GLIMMET]: [
    new SpeciesEvolution(SpeciesId.GLIMMORA, 33, null, null)
  ],
  [SpeciesId.GREAVARD]: [
    new SpeciesEvolution(SpeciesId.HOUNDSTONE, 26, null, null)
  ],
  [SpeciesId.CETODDLE]: [
    new SpeciesEvolution(SpeciesId.CETITAN, 31, null, null)
  ],
  [SpeciesId.FRIGIBAX]: [
    new SpeciesEvolution(SpeciesId.ARCTIBAX, 26, null, null)
  ],
  [SpeciesId.ARCTIBAX]: [
    new SpeciesEvolution(SpeciesId.BAXCALIBUR, 42, null, null)
  ],
  [SpeciesId.GIMMIGHOUL]: [
    new SpeciesFormEvolution(SpeciesId.GHOLDENGO, "chest", "", 30, null, null),
    new SpeciesFormEvolution(SpeciesId.GHOLDENGO, "roaming", "", 30, null, null),
  ],
  [SpeciesId.POLTCHAGEIST]: [
    new SpeciesFormEvolution(SpeciesId.SINISTCHA, "counterfeit", "unremarkable", 28, null, null),
    new SpeciesFormEvolution(SpeciesId.SINISTCHA, "artisan", "masterpiece", 28, null, null),
  ],
  [SpeciesId.PALDEA_WOOPER]: [
    new SpeciesEvolution(SpeciesId.CLODSIRE, 16, null, null)
  ]/*,
  [SpeciesId.PIKACHU]: [
    new SpeciesFormEvolution(SpeciesId.ALOLA_RAICHU, "", "", 1, EvolutionItem.SHINY_STONE, null, [30, 35, 40]),
    new SpeciesFormEvolution(SpeciesId.ALOLA_RAICHU, "partner", "", 1, EvolutionItem.SHINY_STONE, null, [30, 35, 40]),
    new SpeciesFormEvolution(SpeciesId.RAICHU, "", "", 1, EvolutionItem.THUNDER_STONE, null, [30, 35, 40]),
    new SpeciesFormEvolution(SpeciesId.RAICHU, "partner", "", 1, EvolutionItem.THUNDER_STONE, null, [30, 35, 40])
  ],
  [SpeciesId.NIDORINA]: [
    new SpeciesEvolution(SpeciesId.NIDOQUEEN, 1, EvolutionItem.MOON_STONE, null, [32, 36, 42])
  ],
  [SpeciesId.NIDORINO]: [
    new SpeciesEvolution(SpeciesId.NIDOKING, 1, EvolutionItem.MOON_STONE, null, [32, 36, 42])
  ],
  [SpeciesId.CLEFAIRY]: [
    new SpeciesEvolution(SpeciesId.CLEFABLE, 1, EvolutionItem.MOON_STONE, null, [32, 32, 36])
  ],
  [SpeciesId.VULPIX]: [
    new SpeciesEvolution(SpeciesId.NINETALES, 1, EvolutionItem.FIRE_STONE, null, [30, 35, 40])
  ],
  [SpeciesId.JIGGLYPUFF]: [
    new SpeciesEvolution(SpeciesId.WIGGLYTUFF, 1, EvolutionItem.MOON_STONE, null, [30, 35, 40])
  ],
  [SpeciesId.GLOOM]: [
    new SpeciesEvolution(SpeciesId.VILEPLUME, 1, EvolutionItem.LEAF_STONE, null, [30, 35, 40]),
    new SpeciesEvolution(SpeciesId.BELLOSSOM, 1, EvolutionItem.SUN_STONE, null, [30, 35, 40])
  ],
  [SpeciesId.GROWLITHE]: [
    new SpeciesEvolution(SpeciesId.ARCANINE, 1, EvolutionItem.FIRE_STONE, null, [30, 35, 40])
  ],
  [SpeciesId.POLIWHIRL]: [
    new SpeciesEvolution(SpeciesId.POLIWRATH, 1, EvolutionItem.WATER_STONE, null, [30, 35, 40]),
    new SpeciesEvolution(SpeciesId.POLITOED, 1, EvolutionItem.LINKING_CORD, null, [30, 35, 40])
  ],
  [SpeciesId.WEEPINBELL]: [
    new SpeciesEvolution(SpeciesId.VICTREEBEL, 1, EvolutionItem.LEAF_STONE, null, [31, 36, 41])
  ],
  [SpeciesId.MAGNETON]: [
    new SpeciesEvolution(SpeciesId.MAGNEZONE, 1, EvolutionItem.THUNDER_STONE, null, [50, 55, 60])
  ],
  [SpeciesId.SHELLDER]: [
    new SpeciesEvolution(SpeciesId.CLOYSTER, 1, EvolutionItem.WATER_STONE, null, [36, 40, 44])
  ],
  [SpeciesId.EXEGGCUTE]: [
    new SpeciesEvolution(SpeciesId.ALOLA_EXEGGUTOR, 1, EvolutionItem.SUN_STONE, null, [35, 40, 40]),
    new SpeciesEvolution(SpeciesId.EXEGGUTOR, 1, EvolutionItem.LEAF_STONE, null, [35, 40, 40])
  ],
  [SpeciesId.TANGELA]: [
    new SpeciesEvolution(SpeciesId.TANGROWTH, 34, null, {key: EvoCondKey.MOVE, move: MoveId.ANCIENT_POWER}, [29, 37, 45])
  ],
  [SpeciesId.LICKITUNG]: [
    new SpeciesEvolution(SpeciesId.LICKILICKY, 32, null, {key: EvoCondKey.MOVE, move: MoveId.ROLLOUT}, [33, 38, 48])
  ],
  [SpeciesId.STARYU]: [
    new SpeciesEvolution(SpeciesId.STARMIE, 1, EvolutionItem.WATER_STONE, null, [20, 25, 30])
  ],
  [SpeciesId.EEVEE]: [
    new SpeciesFormEvolution(SpeciesId.SYLVEON, "", "", 1, null, [{key: EvoCondKey.FRIENDSHIP, value: 120}, {key: EvoCondKey.MOVE_TYPE, pkmnType: PokemonType.FAIRY}], [24, 28, 28]),
    new SpeciesFormEvolution(SpeciesId.SYLVEON, "partner", "", 1, null, [{key: EvoCondKey.FRIENDSHIP, value: 120}, {key: EvoCondKey.MOVE_TYPE, pkmnType: PokemonType.FAIRY}], [24, 28, 28]),
    new SpeciesFormEvolution(SpeciesId.ESPEON, "", "", 1, null, [{key: EvoCondKey.FRIENDSHIP, value: 120}, {key: EvoCondKey.TIME, time: [TimeOfDay.DAWN, TimeOfDay.DAY]}], [24, 28, 28]),
    new SpeciesFormEvolution(SpeciesId.ESPEON, "partner", "", 1, null, [{key: EvoCondKey.FRIENDSHIP, value: 120}, {key: EvoCondKey.TIME, time: [TimeOfDay.DAWN, TimeOfDay.DAY]}], [24, 28, 28]),
    new SpeciesFormEvolution(SpeciesId.UMBREON, "", "", 1, null, [{key: EvoCondKey.FRIENDSHIP, value: 120}, {key: EvoCondKey.TIME, time: [TimeOfDay.DUSK, TimeOfDay.NIGHT]}], [24, 28, 28]),
    new SpeciesFormEvolution(SpeciesId.UMBREON, "partner", "", 1, null, [{key: EvoCondKey.FRIENDSHIP, value: 120}, {key: EvoCondKey.TIME, time: [TimeOfDay.DUSK, TimeOfDay.NIGHT]}], [24, 28, 28]),
    new SpeciesFormEvolution(SpeciesId.VAPOREON, "", "", 1, EvolutionItem.WATER_STONE, null, [24, 28, 28]),
    new SpeciesFormEvolution(SpeciesId.VAPOREON, "partner", "", 1, EvolutionItem.WATER_STONE, null, [24, 28, 28]),
    new SpeciesFormEvolution(SpeciesId.JOLTEON, "", "", 1, EvolutionItem.THUNDER_STONE, null, [24, 28, 28]),
    new SpeciesFormEvolution(SpeciesId.JOLTEON, "partner", "", 1, EvolutionItem.THUNDER_STONE, null, [24, 28, 28]),
    new SpeciesFormEvolution(SpeciesId.FLAREON, "", "", 1, EvolutionItem.FIRE_STONE, null, [24, 28, 28]),
    new SpeciesFormEvolution(SpeciesId.FLAREON, "partner", "", 1, EvolutionItem.FIRE_STONE, null, [24, 28, 28]),
    new SpeciesFormEvolution(SpeciesId.LEAFEON, "", "", 1, EvolutionItem.LEAF_STONE, null, [24, 28, 28]),
    new SpeciesFormEvolution(SpeciesId.LEAFEON, "partner", "", 1, EvolutionItem.LEAF_STONE, null, [24, 28, 28]),
    new SpeciesFormEvolution(SpeciesId.GLACEON, "", "", 1, EvolutionItem.ICE_STONE, null, [24, 28, 28]),
    new SpeciesFormEvolution(SpeciesId.GLACEON, "partner", "", 1, EvolutionItem.ICE_STONE, null, [24, 28, 28])
  ],
  [SpeciesId.TOGETIC]: [
    new SpeciesEvolution(SpeciesId.TOGEKISS, 1, EvolutionItem.SHINY_STONE, null, [40, 45, 50])
  ],
  [SpeciesId.AIPOM]: [
    new SpeciesEvolution(SpeciesId.AMBIPOM, 32, null, {key: EvoCondKey.MOVE, move: MoveId.DOUBLE_HIT}, [33, 38, 38])
  ],
  [SpeciesId.SUNKERN]: [
    new SpeciesEvolution(SpeciesId.SUNFLORA, 1, EvolutionItem.SUN_STONE, null, [16, 18, 20])
  ],
  [SpeciesId.YANMA]: [
    new SpeciesEvolution(SpeciesId.YANMEGA, 33, null, {key: EvoCondKey.MOVE, move: MoveId.ANCIENT_POWER}, [34, 42, 50])
  ],
  [SpeciesId.MURKROW]: [
    new SpeciesEvolution(SpeciesId.HONCHKROW, 1, EvolutionItem.DUSK_STONE, null, [26, 32, 38])
  ],
  [SpeciesId.MISDREAVUS]: [
    new SpeciesEvolution(SpeciesId.MISMAGIUS, 1, EvolutionItem.DUSK_STONE, null, [22, 26, 30])
  ],
  [SpeciesId.GIRAFARIG]: [
    new SpeciesEvolution(SpeciesId.FARIGIRAF, 32, null, {key: EvoCondKey.MOVE, move: MoveId.TWIN_BEAM}, [33, 38, 48])
  ],
  [SpeciesId.DUNSPARCE]: [
    new SpeciesFormEvolution(SpeciesId.DUDUNSPARCE, "", "three-segment", 32, null, [{key: EvoCondKey.RANDOM_FORM, value: 4}, {key: EvoCondKey.MOVE, move: MoveId.HYPER_DRILL}], [33, 38, 48]),
    new SpeciesFormEvolution(SpeciesId.DUDUNSPARCE, "", "two-segment", 32, null, {key: EvoCondKey.MOVE, move: MoveId.HYPER_DRILL}, [33, 38, 48])
  ],
  [SpeciesId.GLIGAR]: [
    new SpeciesEvolution(SpeciesId.GLISCOR, 1, EvolutionItem.RAZOR_FANG, {key: EvoCondKey.TIME, time: [TimeOfDay.DUSK, TimeOfDay.NIGHT]}, [48, 56, 64])
  ],
  [SpeciesId.SNEASEL]: [
    new SpeciesEvolution(SpeciesId.WEAVILE, 1, EvolutionItem.RAZOR_CLAW, {key: EvoCondKey.TIME, time: [TimeOfDay.DUSK, TimeOfDay.NIGHT]}, [48, 56, 64])
  ],
  [SpeciesId.HAPPINY]: [
    new SpeciesEvolution(SpeciesId.CHANSEY, 1, EvolutionItem.OVAL_STONE, {key: EvoCondKey.TIME, time: [TimeOfDay.DAWN, TimeOfDay.DAY]}, [20, 25, 25])
  ],
  [SpeciesId.URSARING]: [
    new SpeciesEvolution(SpeciesId.URSALUNA, 1, EvolutionItem.PEAT_BLOCK, null, [70, 85, 100]) //Ursaring does not evolve into Bloodmoon Ursaluna
  ],
  [SpeciesId.PILOSWINE]: [
    new SpeciesEvolution(SpeciesId.MAMOSWINE, 1, null, {key: EvoCondKey.MOVE, move: MoveId.ANCIENT_POWER}, [48, 56, 64])
  ],
  [SpeciesId.STANTLER]: [
    new SpeciesEvolution(SpeciesId.WYRDEER, 25, null, {key: EvoCondKey.MOVE, move: MoveId.PSYSHIELD_BASH}, [35, 45, 55])
  ],
  [SpeciesId.LOMBRE]: [
    new SpeciesEvolution(SpeciesId.LUDICOLO, 1, EvolutionItem.WATER_STONE, null, [35, 42, 49])
  ],
  [SpeciesId.NUZLEAF]: [
    new SpeciesEvolution(SpeciesId.SHIFTRY, 1, EvolutionItem.LEAF_STONE, null, [35, 42, 49])
  ],
  [SpeciesId.NOSEPASS]: [
    new SpeciesEvolution(SpeciesId.PROBOPASS, 1, EvolutionItem.THUNDER_STONE, null, [32, 36, 40])
  ],
  [SpeciesId.SKITTY]: [
    new SpeciesEvolution(SpeciesId.DELCATTY, 1, EvolutionItem.MOON_STONE, null, [16, 20, 20])
  ],
  [SpeciesId.ROSELIA]: [
    new SpeciesEvolution(SpeciesId.ROSERADE, 1, EvolutionItem.SHINY_STONE, null, [32, 32, 36])
  ],
  [SpeciesId.BONSLY]: [
    new SpeciesEvolution(SpeciesId.SUDOWOODO, 1, null, {key: EvoCondKey.MOVE, move: MoveId.MIMIC}, [19, 24, 24])
  ],
  [SpeciesId.MIME_JR]: [
    new SpeciesEvolution(SpeciesId.GALAR_MR_MIME, 1, null, [{key: EvoCondKey.MOVE, move: MoveId.MIMIC}, {key: EvoCondKey.TIME, time: [TimeOfDay.DUSK, TimeOfDay.NIGHT]}], [19, 24, 24]),
    new SpeciesEvolution(SpeciesId.MR_MIME, 1, null, [{key: EvoCondKey.MOVE, move: MoveId.MIMIC}, {key: EvoCondKey.TIME, time: [TimeOfDay.DAWN, TimeOfDay.DAY]}], [19, 24, 24])
  ],
  [SpeciesId.PANSAGE]: [
    new SpeciesEvolution(SpeciesId.SIMISAGE, 1, EvolutionItem.LEAF_STONE, null, [24, 28, 32])
  ],
  [SpeciesId.PANSEAR]: [
    new SpeciesEvolution(SpeciesId.SIMISEAR, 1, EvolutionItem.FIRE_STONE, null, [24, 28, 32])
  ],
  [SpeciesId.PANPOUR]: [
    new SpeciesEvolution(SpeciesId.SIMIPOUR, 1, EvolutionItem.WATER_STONE, null, [24, 28, 32])
  ],
  [SpeciesId.MUNNA]: [
    new SpeciesEvolution(SpeciesId.MUSHARNA, 1, EvolutionItem.MOON_STONE, null, [28, 32, 32])
  ],
  [SpeciesId.COTTONEE]: [
    new SpeciesEvolution(SpeciesId.WHIMSICOTT, 1, EvolutionItem.SUN_STONE, null, [28, 32, 32])
  ],
  [SpeciesId.PETILIL]: [
    new SpeciesEvolution(SpeciesId.HISUI_LILLIGANT, 1, EvolutionItem.DAWN_STONE, null, [28, 32, 32]),
    new SpeciesEvolution(SpeciesId.LILLIGANT, 1, EvolutionItem.SUN_STONE, null, [28, 32, 32])
  ],
  [SpeciesId.BASCULIN]: [
    // TODO: Uncomment evo delay when different evo condition is implemented
    new SpeciesFormEvolution(SpeciesId.BASCULEGION, "white-striped", "female", 40, null, [{key: EvoCondKey.GENDER, gender: Gender.FEMALE}], /* [45, 65, 85] ),
    new SpeciesFormEvolution(SpeciesId.BASCULEGION, "white-striped", "male", 40, null, [{key: EvoCondKey.GENDER, gender: Gender.MALE}], /* [45, 65, 85 ] )
  ],
  [SpeciesId.MINCCINO]: [
    new SpeciesEvolution(SpeciesId.CINCCINO, 1, EvolutionItem.SHINY_STONE, null, [24, 32, 32])
  ],
  [SpeciesId.EELEKTRIK]: [
    new SpeciesEvolution(SpeciesId.EELEKTROSS, 1, EvolutionItem.THUNDER_STONE, null, [49, 54, 54])
  ],
  [SpeciesId.LAMPENT]: [
    new SpeciesEvolution(SpeciesId.CHANDELURE, 1, EvolutionItem.DUSK_STONE, null, [51, 56, 56])
  ],
  [SpeciesId.FLOETTE]: [
    new SpeciesEvolution(SpeciesId.FLORGES, 1, EvolutionItem.SHINY_STONE, null, [29, 34, 39])
  ],
  [SpeciesId.DOUBLADE]: [
    new SpeciesEvolution(SpeciesId.AEGISLASH, 1, EvolutionItem.DUSK_STONE, null, [50, 60, 70])
  ],
  [SpeciesId.HELIOPTILE]: [
    new SpeciesEvolution(SpeciesId.HELIOLISK, 1, EvolutionItem.SUN_STONE, null, [32, 36, 36])
  ],
  [SpeciesId.CHARJABUG]: [
    new SpeciesEvolution(SpeciesId.VIKAVOLT, 1, EvolutionItem.THUNDER_STONE, null, [40, 45, 45])
  ],
  [SpeciesId.CRABRAWLER]: [
    new SpeciesEvolution(SpeciesId.CRABOMINABLE, 1, EvolutionItem.ICE_STONE, null, [35, 40, 40])
  ],
  [SpeciesId.ROCKRUFF]: [
    new SpeciesFormEvolution(SpeciesId.LYCANROC, "own-tempo", "dusk", 25, null, null),
    new SpeciesFormEvolution(SpeciesId.LYCANROC, "", "midday", 25, null, {key: EvoCondKey.TIME, time: [TimeOfDay.DAWN, TimeOfDay.DAY]}),
    new SpeciesFormEvolution(SpeciesId.LYCANROC, "", "midnight", 25, null, {key: EvoCondKey.TIME, time: [TimeOfDay.DUSK, TimeOfDay.NIGHT]})
  ],
  [SpeciesId.STEENEE]: [
    new SpeciesEvolution(SpeciesId.TSAREENA, 28, null, {key: EvoCondKey.MOVE, move: MoveId.STOMP}, [29, 34, 39])
  ],
  [SpeciesId.POIPOLE]: [
    new SpeciesEvolution(SpeciesId.NAGANADEL, 1, null, {key: EvoCondKey.MOVE, move: MoveId.DRAGON_PULSE}, [53, 59, 61])
  ],
  [SpeciesId.ALOLA_SANDSHREW]: [
    new SpeciesEvolution(SpeciesId.ALOLA_SANDSLASH, 1, EvolutionItem.ICE_STONE, null, [22, 22, 22])
  ],
  [SpeciesId.ALOLA_VULPIX]: [
    new SpeciesEvolution(SpeciesId.ALOLA_NINETALES, 1, EvolutionItem.ICE_STONE, null, [30, 35, 40])
  ],
  [SpeciesId.APPLIN]: [
    new SpeciesEvolution(SpeciesId.DIPPLIN, 1, EvolutionItem.SYRUPY_APPLE, null, [24, 24, 28]),
    new SpeciesEvolution(SpeciesId.FLAPPLE, 1, EvolutionItem.TART_APPLE, null, [24, 24, 28]),
    new SpeciesEvolution(SpeciesId.APPLETUN, 1, EvolutionItem.SWEET_APPLE, null, [24, 24, 28])
  ],
  [SpeciesId.CLOBBOPUS]: [
    new SpeciesEvolution(SpeciesId.GRAPPLOCT, 35, null, {key: EvoCondKey.MOVE, move: MoveId.TAUNT}/*Once Taunt is implemented, change evo level to 1 and delay to LONG)
  ],
  [SpeciesId.SINISTEA]: [
    new SpeciesFormEvolution(SpeciesId.POLTEAGEIST, "phony", "phony", 1, EvolutionItem.CRACKED_POT, null, [30, 35, 40]),
    new SpeciesFormEvolution(SpeciesId.POLTEAGEIST, "antique", "antique", 1, EvolutionItem.CHIPPED_POT, null, [30, 35, 40])
  ],
  [SpeciesId.MILCERY]: [
    new SpeciesFormEvolution(SpeciesId.ALCREMIE, "", "vanilla-cream", 1, EvolutionItem.STRAWBERRY_SWEET,
      {key: EvoCondKey.BIOME, biome: [ BiomeId.TOWN, BiomeId.PLAINS, BiomeId.GRASS, BiomeId.TALL_GRASS, BiomeId.METROPOLIS ]},
      [20, 25, 25]),
    new SpeciesFormEvolution(SpeciesId.ALCREMIE, "", "ruby-cream", 1, EvolutionItem.STRAWBERRY_SWEET,
      {key: EvoCondKey.BIOME, biome: [ BiomeId.BADLANDS, BiomeId.VOLCANO, BiomeId.GRAVEYARD, BiomeId.FACTORY, BiomeId.SLUM ]},
      [20, 25, 25]),
    new SpeciesFormEvolution(SpeciesId.ALCREMIE, "", "matcha-cream", 1, EvolutionItem.STRAWBERRY_SWEET,
      {key: EvoCondKey.BIOME, biome: [ BiomeId.FOREST, BiomeId.SWAMP, BiomeId.MEADOW, BiomeId.JUNGLE ]},
      [20, 25, 25]),
    new SpeciesFormEvolution(SpeciesId.ALCREMIE, "", "mint-cream", 1, EvolutionItem.STRAWBERRY_SWEET,
      {key: EvoCondKey.BIOME, biome: [ BiomeId.SEA, BiomeId.BEACH, BiomeId.LAKE, BiomeId.SEABED ]},
      [20, 25, 25]),
    new SpeciesFormEvolution(SpeciesId.ALCREMIE, "", "lemon-cream", 1, EvolutionItem.STRAWBERRY_SWEET,
      {key: EvoCondKey.BIOME, biome: [ BiomeId.DESERT, BiomeId.POWER_PLANT, BiomeId.DOJO, BiomeId.RUINS, BiomeId.CONSTRUCTION_SITE ]},
      [20, 25, 25]),
    new SpeciesFormEvolution(SpeciesId.ALCREMIE, "", "salted-cream", 1, EvolutionItem.STRAWBERRY_SWEET,
      {key: EvoCondKey.BIOME, biome: [ BiomeId.MOUNTAIN, BiomeId.CAVE, BiomeId.ICE_CAVE, BiomeId.FAIRY_CAVE, BiomeId.SNOWY_FOREST ]},
      [20, 25, 25]),
    new SpeciesFormEvolution(SpeciesId.ALCREMIE, "", "ruby-swirl", 1, EvolutionItem.STRAWBERRY_SWEET,
      {key: EvoCondKey.BIOME, biome: [ BiomeId.WASTELAND, BiomeId.LABORATORY ]},
      [20, 25, 25]),
    new SpeciesFormEvolution(SpeciesId.ALCREMIE, "", "caramel-swirl", 1, EvolutionItem.STRAWBERRY_SWEET,
      {key: EvoCondKey.BIOME, biome: [ BiomeId.TEMPLE, BiomeId.ISLAND ]},
      [20, 25, 25]),
    new SpeciesFormEvolution(SpeciesId.ALCREMIE, "", "rainbow-swirl", 1, EvolutionItem.STRAWBERRY_SWEET,
      {key: EvoCondKey.BIOME, biome: [ BiomeId.ABYSS, BiomeId.SPACE, BiomeId.END ]},
      [20, 25, 25])
  ],
  [SpeciesId.DURALUDON]: [
    new SpeciesFormEvolution(SpeciesId.ARCHALUDON, "", "", 1, EvolutionItem.METAL_ALLOY, null, [65, 80, 95])
  ],
  [SpeciesId.KUBFU]: [
    new SpeciesFormEvolution(SpeciesId.URSHIFU, "", "single-strike", 1, EvolutionItem.SCROLL_OF_DARKNESS, null, [50, 60, 70]),
    new SpeciesFormEvolution(SpeciesId.URSHIFU, "", "rapid-strike", 1, EvolutionItem.SCROLL_OF_WATERS, null, [50, 60, 70])
  ],
  [SpeciesId.GALAR_DARUMAKA]: [
    new SpeciesEvolution(SpeciesId.GALAR_DARMANITAN, 1, EvolutionItem.ICE_STONE, null, [35, 35, 35])
  ],
  [SpeciesId.HISUI_GROWLITHE]: [
    new SpeciesEvolution(SpeciesId.HISUI_ARCANINE, 1, EvolutionItem.FIRE_STONE, null, [35, 40, 45])
  ],
  [SpeciesId.HISUI_VOLTORB]: [
    new SpeciesEvolution(SpeciesId.HISUI_ELECTRODE, 1, EvolutionItem.LEAF_STONE, null, [30, 30, 30])
  ],
  [SpeciesId.HISUI_QWILFISH]: [
    new SpeciesEvolution(SpeciesId.OVERQWIL, 28, null, {key: EvoCondKey.MOVE, move: MoveId.BARB_BARRAGE}, [38, 48, 58])
  ],
  [SpeciesId.HISUI_SNEASEL]: [
    new SpeciesEvolution(SpeciesId.SNEASLER, 1, EvolutionItem.RAZOR_CLAW, {key: EvoCondKey.TIME, time: [TimeOfDay.DAWN, TimeOfDay.DAY]}, [48, 54, 60])
  ],
  [SpeciesId.CHARCADET]: [
    new SpeciesEvolution(SpeciesId.ARMAROUGE, 1, EvolutionItem.AUSPICIOUS_ARMOR, null, [30, 35, 35]),
    new SpeciesEvolution(SpeciesId.CERULEDGE, 1, EvolutionItem.MALICIOUS_ARMOR, null, [30, 35, 35])
  ],
  [SpeciesId.TADBULB]: [
    new SpeciesEvolution(SpeciesId.BELLIBOLT, 1, EvolutionItem.THUNDER_STONE, null, [20, 28, 28])
  ],
  [SpeciesId.CAPSAKID]: [
    new SpeciesEvolution(SpeciesId.SCOVILLAIN, 1, EvolutionItem.FIRE_STONE, null, [25, 30, 30])
  ],
  [SpeciesId.CETODDLE]: [
    new SpeciesEvolution(SpeciesId.CETITAN, 1, EvolutionItem.ICE_STONE, null, [40, 44, 48])
  ],
  [SpeciesId.POLTCHAGEIST]: [
    new SpeciesFormEvolution(SpeciesId.SINISTCHA, "counterfeit", "unremarkable", 1, EvolutionItem.UNREMARKABLE_TEACUP, null, [30, 35, 40]),
    new SpeciesFormEvolution(SpeciesId.SINISTCHA, "artisan", "masterpiece", 1, EvolutionItem.MASTERPIECE_TEACUP, null, [30, 35, 40])
  ],
  [SpeciesId.DIPPLIN]: [
    new SpeciesEvolution(SpeciesId.HYDRAPPLE, 1, null, {key: EvoCondKey.MOVE, move: MoveId.DRAGON_CHEER}, [56, 68, 80])
  ],
  [SpeciesId.KADABRA]: [
    new SpeciesEvolution(SpeciesId.ALAKAZAM, 1, EvolutionItem.LINKING_CORD, null, [40, 45, 50])
  ],
  [SpeciesId.MACHOKE]: [
    new SpeciesEvolution(SpeciesId.MACHAMP, 1, EvolutionItem.LINKING_CORD, null, [38, 46, 54])
  ],
  [SpeciesId.GRAVELER]: [
    new SpeciesEvolution(SpeciesId.GOLEM, 1, EvolutionItem.LINKING_CORD, null, [35, 45, 55])
  ],
  [SpeciesId.HAUNTER]: [
    new SpeciesEvolution(SpeciesId.GENGAR, 1, EvolutionItem.LINKING_CORD, null, [40, 45, 50])
  ],
  [SpeciesId.ONIX]: [
    new SpeciesEvolution(SpeciesId.STEELIX, 1, EvolutionItem.LINKING_CORD, {key: EvoCondKey.MOVE_TYPE, pkmnType: PokemonType.STEEL}, [35, 40, 45])
  ],
  [SpeciesId.RHYDON]: [
    new SpeciesEvolution(SpeciesId.RHYPERIOR, 1, EvolutionItem.PROTECTOR, null, [72, 82, 92])
  ],
  [SpeciesId.SEADRA]: [
    new SpeciesEvolution(SpeciesId.KINGDRA, 1, EvolutionItem.DRAGON_SCALE, null, [42, 52, 62])
  ],
  [SpeciesId.SCYTHER]: [
    new SpeciesEvolution(SpeciesId.SCIZOR, 1, EvolutionItem.LINKING_CORD, {key: EvoCondKey.MOVE_TYPE, pkmnType: PokemonType.STEEL}, [40, 50, 60]),
    new SpeciesEvolution(SpeciesId.KLEAVOR, 1, EvolutionItem.BLACK_AUGURITE, null, [40, 50, 60])
  ],
  [SpeciesId.ELECTABUZZ]: [
    new SpeciesEvolution(SpeciesId.ELECTIVIRE, 1, EvolutionItem.ELECTIRIZER, null, [50, 60, 70])
  ],
  [SpeciesId.MAGMAR]: [
    new SpeciesEvolution(SpeciesId.MAGMORTAR, 1, EvolutionItem.MAGMARIZER, null, [50, 60, 70])
  ],
  [SpeciesId.PORYGON]: [
    new SpeciesEvolution(SpeciesId.PORYGON2, 1, EvolutionItem.UPGRADE, null, [32, 40, 48])
  ],
  [SpeciesId.PORYGON2]: [
    new SpeciesEvolution(SpeciesId.PORYGON_Z, 1, EvolutionItem.DUBIOUS_DISC, null, [64, 72, 80])
  ],
  [SpeciesId.FEEBAS]: [
    new SpeciesEvolution(SpeciesId.MILOTIC, 1, EvolutionItem.PRISM_SCALE, null, [30, 35, 40])
  ],
  [SpeciesId.DUSCLOPS]: [
    new SpeciesEvolution(SpeciesId.DUSKNOIR, 1, EvolutionItem.REAPER_CLOTH, null, [47, 57, 67])
  ],
  [SpeciesId.CLAMPERL]: [
    new SpeciesEvolution(SpeciesId.HUNTAIL, 1, EvolutionItem.LINKING_CORD, {key: EvoCondKey.HELD_ITEM, itemKey: "DEEP_SEA_TOOTH"}, [40, 40, 50]),
    new SpeciesEvolution(SpeciesId.GOREBYSS, 1, EvolutionItem.LINKING_CORD, {key: EvoCondKey.HELD_ITEM, itemKey: "DEEP_SEA_SCALE"}, [40, 40, 50])
  ],
  [SpeciesId.BOLDORE]: [
    new SpeciesEvolution(SpeciesId.GIGALITH, 1, EvolutionItem.LINKING_CORD, null, [35, 40, 45])
  ],
  [SpeciesId.GURDURR]: [
    new SpeciesEvolution(SpeciesId.CONKELDURR, 1, EvolutionItem.LINKING_CORD, null, [35, 40, 45])
  ],
  [SpeciesId.KARRABLAST]: [
    new SpeciesEvolution(SpeciesId.ESCAVALIER, 1, EvolutionItem.LINKING_CORD, {key: EvoCondKey.SPECIES_CAUGHT, speciesCaught: SpeciesId.SHELMET}, [30, 30, 35])
  ],
  [SpeciesId.SHELMET]: [
    new SpeciesEvolution(SpeciesId.ACCELGOR, 1, EvolutionItem.LINKING_CORD, {key: EvoCondKey.SPECIES_CAUGHT, speciesCaught: SpeciesId.KARRABLAST}, [30, 30, 35])
  ],
  [SpeciesId.SPRITZEE]: [
    new SpeciesEvolution(SpeciesId.AROMATISSE, 1, EvolutionItem.SACHET, null, [25, 30, 35])
  ],
  [SpeciesId.SWIRLIX]: [
    new SpeciesEvolution(SpeciesId.SLURPUFF, 1, EvolutionItem.WHIPPED_DREAM, null, [25, 30, 35])
  ],
  [SpeciesId.PHANTUMP]: [
    new SpeciesEvolution(SpeciesId.TREVENANT, 1, EvolutionItem.LINKING_CORD, null, [30, 35, 40])
  ],
  [SpeciesId.PUMPKABOO]: [
    new SpeciesEvolution(SpeciesId.GOURGEIST, 1, EvolutionItem.LINKING_CORD, null, [30, 35, 40])
  ],
  [SpeciesId.ALOLA_GRAVELER]: [
    new SpeciesEvolution(SpeciesId.ALOLA_GOLEM, 1, EvolutionItem.LINKING_CORD, null, [35, 45, 55])
  ],
  [SpeciesId.PRIMEAPE]: [
    new SpeciesEvolution(SpeciesId.ANNIHILAPE, 35, null, {key: EvoCondKey.MOVE, move: MoveId.RAGE_FIST}, [45, 55, 65])
  ],
  [SpeciesId.GOLBAT]: [
    new SpeciesEvolution(SpeciesId.CROBAT, 1, null, {key: EvoCondKey.FRIENDSHIP, value: 120}, [42, 48, 54])
  ],
  [SpeciesId.CHANSEY]: [
    new SpeciesEvolution(SpeciesId.BLISSEY, 1, null, {key: EvoCondKey.FRIENDSHIP, value: 180}, [40, 45, 45])
  ],
  [SpeciesId.PICHU]: [
    new SpeciesFormEvolution(SpeciesId.PIKACHU, "spiky", "partner", 1, null, {key: EvoCondKey.FRIENDSHIP, value: 90}, [12, 12, 16]),
    new SpeciesFormEvolution(SpeciesId.PIKACHU, "", "", 1, null, {key: EvoCondKey.FRIENDSHIP, value: 90}, [12, 12, 16]),
  ],
  [SpeciesId.CLEFFA]: [
    new SpeciesEvolution(SpeciesId.CLEFAIRY, 1, null, {key: EvoCondKey.FRIENDSHIP, value: 160}, [12, 12, 16])
  ],
  [SpeciesId.IGGLYBUFF]: [
    new SpeciesEvolution(SpeciesId.JIGGLYPUFF, 1, null, {key: EvoCondKey.FRIENDSHIP, value: 70}, [12, 12, 16])
  ],
  [SpeciesId.TOGEPI]: [
    new SpeciesEvolution(SpeciesId.TOGETIC, 1, null, {key: EvoCondKey.FRIENDSHIP, value: 70}, [20, 25, 25])
  ],
  [SpeciesId.AZURILL]: [
    new SpeciesEvolution(SpeciesId.MARILL, 1, null, {key: EvoCondKey.FRIENDSHIP, value: 70}, [12, 12, 12])
  ],
  [SpeciesId.BUDEW]: [
    new SpeciesEvolution(SpeciesId.ROSELIA, 1, null, [{key: EvoCondKey.FRIENDSHIP, value: 70}, {key: EvoCondKey.TIME, time: [TimeOfDay.DAWN, TimeOfDay.DAY]}], [12, 12, 16])
  ],
  [SpeciesId.BUNEARY]: [
    new SpeciesEvolution(SpeciesId.LOPUNNY, 1, null, {key: EvoCondKey.FRIENDSHIP, value: 50}, [25, 25, 30])
  ],
  [SpeciesId.CHINGLING]: [
    new SpeciesEvolution(SpeciesId.CHIMECHO, 1, null, [{key: EvoCondKey.FRIENDSHIP, value: 90}, {key: EvoCondKey.TIME, time: [TimeOfDay.DUSK, TimeOfDay.NIGHT]}], [20, 25, 25])
  ],
  [SpeciesId.MUNCHLAX]: [
    new SpeciesEvolution(SpeciesId.SNORLAX, 1, null, {key: EvoCondKey.FRIENDSHIP, value: 120}, [30, 30, 30])
  ],
  [SpeciesId.RIOLU]: [
    new SpeciesEvolution(SpeciesId.LUCARIO, 1, null, [{key: EvoCondKey.FRIENDSHIP, value: 120}, {key: EvoCondKey.TIME, time: [TimeOfDay.DAWN, TimeOfDay.DAY]}], [32, 32, 32])
  ],
  [SpeciesId.WOOBAT]: [
    new SpeciesEvolution(SpeciesId.SWOOBAT, 1, null, {key: EvoCondKey.FRIENDSHIP, value: 90}, [20, 25, 25])
  ],
  [SpeciesId.SWADLOON]: [
    new SpeciesEvolution(SpeciesId.LEAVANNY, 1, null, {key: EvoCondKey.FRIENDSHIP, value: 120}, [30, 35, 35])
  ],
  [SpeciesId.TYPE_NULL]: [
    new SpeciesEvolution(SpeciesId.SILVALLY, 1, null, {key: EvoCondKey.FRIENDSHIP, value: 100}, [50, 60, 70])
  ],
  [SpeciesId.ALOLA_MEOWTH]: [
    new SpeciesEvolution(SpeciesId.ALOLA_PERSIAN, 1, null, {key: EvoCondKey.FRIENDSHIP, value: 120}, [28, 28, 28])
  ],
  [SpeciesId.SNOM]: [
    new SpeciesEvolution(SpeciesId.FROSMOTH, 1, null, [{key: EvoCondKey.FRIENDSHIP, value: 90}, {key: EvoCondKey.TIME, time: [TimeOfDay.DUSK, TimeOfDay.NIGHT]}], [20, 25, 25])
  ],
  [SpeciesId.GIMMIGHOUL]: [
    new SpeciesFormEvolution(SpeciesId.GHOLDENGO, "chest", "", 1, null, {key: EvoCondKey.EVO_TREASURE_TRACKER, value: 10}, [50, 60, 70]),
    new SpeciesFormEvolution(SpeciesId.GHOLDENGO, "roaming", "", 1, null, {key: EvoCondKey.EVO_TREASURE_TRACKER, value: 10}, [50, 60, 70])
  ]*/
};

interface PokemonPrevolutions {
  [key: string]: SpeciesId
}

export const pokemonPrevolutions: PokemonPrevolutions = {};

export function initPokemonPrevolutions(): void {
  // TODO: Why do we have empty strings in our array?
  const megaFormKeys = [SpeciesFormKey.MEGA, "", SpeciesFormKey.MEGA_X, "", SpeciesFormKey.MEGA_Y];
  for (const [pk, evolutions] of Object.entries(pokemonEvolutions)) {
    for (const ev of evolutions) {
      if (ev.evoFormKey && megaFormKeys.indexOf(ev.evoFormKey) > -1) {
        continue;
      }
      pokemonPrevolutions[ev.speciesId] = Number.parseInt(pk) as SpeciesId;
    }
  }
}


// TODO: This may cause funny business for double starters such as Pichu/Pikachu
export const pokemonStarters: PokemonPrevolutions = {};

/** The default starters and their evolution lines */
export const defaultStarterSpeciesAndEvolutions: SpeciesId[] = defaultStarterSpecies.flatMap(sId => [sId, ...getEvolutions(sId).values()]);

export function initPokemonStarters(): void {
  const starterKeys = Object.keys(pokemonPrevolutions);
  starterKeys.forEach(pk => {
    const prevolution = pokemonPrevolutions[pk];
    if (Object.hasOwn(speciesStarterCosts, prevolution)) {
      pokemonStarters[pk] = prevolution;
    } else {
      pokemonStarters[pk] = pokemonPrevolutions[prevolution];
    }
  });
}

/**
 * @param speciesId - The ID of the species to get the evolutions of
 * @returns A set containing all the {@linkcode SpeciesId}s the input species can evolve into
 */
export function getEvolutions(speciesId: SpeciesId): Set<SpeciesId> {
  const evolutionIds: Set<SpeciesId> = new Set();
  const recurseEvolutions = (sId: SpeciesId): void => {
    const evolutions = pokemonEvolutions[sId] ?? [];
    for (const evoSpecies of evolutions) {
      evolutionIds.add(evoSpecies.speciesId);
      recurseEvolutions(evoSpecies.speciesId);
    }
  };
  recurseEvolutions(speciesId);
  return evolutionIds;
}

/**
 * @param speciesId - The ID of the species to get the pre-evolutions of
 * @returns An array containing all the {@linkcode SpeciesId}s that can evolve into the input species
 */
export function getPreEvolutions(speciesId: SpeciesId): SpeciesId[] {
  const preEvoSpecies: SpeciesId[] = [];
  let preEvoSpeciesId = pokemonPrevolutions[speciesId];
  while (preEvoSpeciesId) {
    preEvoSpecies.push(preEvoSpeciesId);
    preEvoSpeciesId = pokemonPrevolutions[preEvoSpeciesId];
  }
  return preEvoSpecies;
}
