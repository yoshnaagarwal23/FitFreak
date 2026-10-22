// Built-in food list, inserted once by migration v4. Values are per 100 g.
//
// Sources: "usda" = USDA FoodData Central (SR Legacy) values; "ifct" = Indian Food
// Composition Tables 2017; "estimate" = typical home recipe, varies with oil and
// preparation. Values were compiled by hand and rounded — treat them as reasonable
// approximations, and add a custom food from the label when precision matters.

export type SeedFood = {
  name: string;
  servingLabel: string;
  servingGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  vegetarian: boolean;
  source: 'usda' | 'ifct' | 'estimate';
};

const f = (
  name: string,
  servingLabel: string,
  servingGrams: number,
  [calories, protein, carbs, fat]: [number, number, number, number],
  source: SeedFood['source'],
  vegetarian = true,
): SeedFood => ({ name, servingLabel, servingGrams, calories, protein, carbs, fat, vegetarian, source });

export const SEED_FOODS: SeedFood[] = [
  // Grains & breads
  f('Roti / chapati', '1 roti', 40, [297, 9.6, 46.4, 7.5], 'estimate'),
  f('Plain paratha', '1 paratha', 80, [326, 6.4, 45.4, 13.2], 'estimate'),
  f('White rice, cooked', '1 katori', 150, [130, 2.7, 28.2, 0.3], 'usda'),
  f('Brown rice, cooked', '1 katori', 150, [123, 2.7, 25.6, 1.0], 'usda'),
  f('Oats, dry', '½ cup', 40, [389, 16.9, 66.3, 6.9], 'usda'),
  f('Poha flakes, dry', '½ cup', 40, [346, 6.6, 77.3, 1.2], 'ifct'),
  f('Poha, cooked', '1 plate', 200, [158, 3.0, 26.0, 4.6], 'estimate'),
  f('Upma', '1 plate', 200, [145, 3.5, 21.0, 5.2], 'estimate'),
  f('Idli', '1 idli', 40, [132, 4.3, 27.5, 0.6], 'estimate'),
  f('Plain dosa', '1 dosa', 90, [168, 3.9, 27.5, 4.7], 'estimate'),
  f('Whole wheat bread', '1 slice', 30, [252, 12.4, 42.7, 3.5], 'usda'),
  f('Rava / sooji, dry', '¼ cup', 40, [360, 12.7, 72.8, 1.1], 'usda'),
  f('Besan (chickpea flour)', '¼ cup', 30, [387, 22.4, 57.8, 6.7], 'usda'),

  // Dals & legumes
  f('Toor dal, cooked', '1 katori', 150, [121, 6.8, 23.3, 0.4], 'usda'),
  f('Masoor dal, cooked', '1 katori', 150, [116, 9.0, 20.1, 0.4], 'usda'),
  f('Moong dal, cooked', '1 katori', 150, [105, 7.0, 19.2, 0.4], 'usda'),
  f('Dal tadka', '1 katori', 150, [108, 5.5, 13.5, 3.6], 'estimate'),
  f('Chickpeas (chana), cooked', '1 katori', 150, [164, 8.9, 27.4, 2.6], 'usda'),
  f('Chole', '1 katori', 150, [155, 6.8, 20.0, 5.4], 'estimate'),
  f('Rajma, cooked', '1 katori', 150, [127, 8.7, 22.8, 0.5], 'usda'),
  f('Rajma curry', '1 katori', 150, [135, 6.2, 18.0, 4.3], 'estimate'),
  f('Sambar', '1 katori', 150, [65, 3.0, 9.0, 1.9], 'estimate'),
  f('Moong sprouts, raw', '1 cup', 100, [30, 3.0, 5.9, 0.2], 'usda'),
  f('Soya chunks, dry', '¼ cup', 30, [345, 52.0, 33.0, 0.5], 'estimate'),

  // Dairy & protein
  f('Paneer', '50 g', 50, [265, 18.3, 1.2, 20.8], 'ifct'),
  f('Paneer bhurji', '1 katori', 150, [225, 13.0, 5.0, 17.0], 'estimate'),
  f('Palak paneer', '1 katori', 150, [150, 7.0, 6.0, 11.0], 'estimate'),
  f('Curd / dahi', '1 katori', 150, [61, 3.5, 4.7, 3.3], 'usda'),
  f('Greek yogurt, nonfat', '1 cup', 170, [59, 10.2, 3.6, 0.4], 'usda'),
  f('Milk, whole', '1 glass', 250, [61, 3.2, 4.8, 3.3], 'usda'),
  f('Milk, toned', '1 glass', 250, [58, 3.1, 4.7, 3.0], 'estimate'),
  f('Buttermilk / chaas', '1 glass', 250, [40, 3.3, 4.8, 0.9], 'usda'),
  f('Tofu, firm', '100 g', 100, [144, 17.3, 2.8, 8.7], 'usda'),
  f('Whey protein', '1 scoop', 30, [400, 80.0, 8.0, 5.5], 'estimate'),
  f('Egg, boiled', '1 egg', 50, [155, 12.6, 1.1, 10.6], 'usda', false),

  // Nuts & fats
  f('Peanuts', '1 handful', 30, [567, 25.8, 16.1, 49.2], 'usda'),
  f('Almonds', '10 almonds', 12, [579, 21.2, 21.6, 49.9], 'usda'),
  f('Peanut butter', '1 tbsp', 16, [588, 25.0, 20.0, 50.0], 'usda'),
  f('Ghee', '1 tsp', 5, [900, 0, 0, 100], 'usda'),
  f('Cooking oil', '1 tbsp', 14, [884, 0, 0, 100], 'usda'),
  f('Makhana, roasted', '1 cup', 15, [347, 9.7, 76.9, 0.1], 'estimate'),

  // Fruit & vegetables
  f('Banana', '1 medium', 118, [89, 1.1, 22.8, 0.3], 'usda'),
  f('Apple', '1 medium', 180, [52, 0.3, 13.8, 0.2], 'usda'),
  f('Mango', '1 cup sliced', 165, [60, 0.8, 15.0, 0.4], 'usda'),
  f('Potato, boiled', '1 medium', 150, [87, 1.9, 20.1, 0.1], 'usda'),
  f('Sweet potato, baked', '1 medium', 130, [90, 2.0, 20.7, 0.2], 'usda'),
  f('Spinach (palak), raw', '1 cup', 30, [23, 2.9, 3.6, 0.4], 'usda'),
];
