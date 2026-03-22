export const LADDER_ORDER = [
  'mens_singles',
  'mens_doubles',
  'mixed_doubles',
  'womens_singles',
  'womens_doubles',
]

export const DOUBLES_LADDERS = [
  'mens_doubles',
  'mixed_doubles',
  'womens_doubles',
]

export const LADDER_RULE_COPY = {
  male: {
    eligible: ['mens_singles', 'mens_doubles', 'mixed_doubles'],
    summary:
      'You can appear on up to two ladders total, and your options are mens singles, mens doubles, and mixed doubles.',
    challenge:
      'Challenge rule: if you are unranked or below #7, you can only challenge up to #7. Once you are ranked #7 or higher, you can challenge up to three spots above you.',
  },
  female: {
    eligible: ['womens_singles', 'womens_doubles', 'mixed_doubles'],
    summary:
      'You can appear on up to two ladders total, and your options are womens singles, womens doubles, and mixed doubles.',
    challenge:
      'Challenge rule: if you are unranked or below #7, you can only challenge up to #7. Once you are ranked #7 or higher, you can challenge up to three spots above you.',
  },
}
