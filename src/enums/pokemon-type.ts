/**
 * A `PokemonType` represents the type of a Pokemon or its moves.
 * @see {@link https://bulbapedia.bulbagarden.net/wiki/Type}
 */
export enum PokemonType {
  /** Also known as {@link https://bulbapedia.bulbagarden.net/wiki/Type#Typeless | typeless}. */
  UNKNOWN = -1,

  NORMAL = 0,
  FIGHTING, // 1
  FLYING, // 2
  POISON, // 3
  GROUND, // 4
  ROCK, // 5
  BUG, // 6
  GHOST, // 7
  STEEL, // 8
  FIRE, // 9
  WATER, // 10
  GRASS, // 11
  ELECTRIC, // 12
  PSYCHIC, // 13
  ICE, // 14
  DRAGON, // 15
  DARK, // 16
  FAIRY, // 17

  /**
   * A pseudo-type used for Terastallization.
   * @see {@link https://bulbapedia.bulbagarden.net/wiki/Stellar_(type)}
   */
  STELLAR, // 18
}

/** Types that a Pokemon can naturally have; excludes Typeless and Stellar */
export type RegularPokemonType = Exclude<PokemonType, PokemonType.UNKNOWN | PokemonType.STELLAR>;

/** The smallest legal value for a {@linkcode PokemonType} (excludes Typeless) */
export const MIN_REGULAR_POKEMON_TYPE = PokemonType.NORMAL;

/** The largest legal value for a {@linkcode PokemonType} (excludes Stellar) */
export const MAX_REGULAR_POKEMON_TYPE = PokemonType.FAIRY;

/** The largest legal value for a {@linkcode PokemonType} (includes Stellar) */
export const MAX_POKEMON_TYPE = PokemonType.STELLAR;
