export interface PepeModel {
    name: string;
    rarity: 'common' | 'rare' | 'legendary';
    chance: number;
    tgsFile: string;
}

export const PEPE_MODELS: PepeModel[] = [
    // Legendary (5% chance total) - 9 models = 0.6% each
    { name: 'Midas Pepe', rarity: 'legendary', chance: 0.6, tgsFile: 'midas_pepe.tgs' },
    { name: 'X-Ray', rarity: 'legendary', chance: 0.6, tgsFile: 'x-ray.tgs' },
    { name: 'Gucci Leap', rarity: 'legendary', chance: 0.6, tgsFile: 'gucci leap.tgs' },
    { name: 'Pink Galaxy', rarity: 'legendary', chance: 0.6, tgsFile: 'pink_galaxy.tgs' },
    { name: 'Steel Frog', rarity: 'legendary', chance: 0.6, tgsFile: 'steel_frog.tgs' },
    { name: 'Cozy Galaxy', rarity: 'legendary', chance: 0.6, tgsFile: 'cozy_galaxy.tgs' },
    { name: 'Emerald Plush', rarity: 'legendary', chance: 0.6, tgsFile: 'emerald_plush.tgs' },
    { name: 'Sketchy', rarity: 'legendary', chance: 0.6, tgsFile: 'sketchy.tgs' },
    { name: 'Aqua Plush', rarity: 'legendary', chance: 0.6, tgsFile: 'aqua_plush.tgs' },

    // Rare (25% chance total) - 19 models
    { name: 'Polka Dots', rarity: 'rare', chance: 1.3, tgsFile: 'polka_dots.tgs' },
    { name: 'Magnate', rarity: 'rare', chance: 1.3, tgsFile: 'magnate.tgs' },
    { name: 'Yellow Purp', rarity: 'rare', chance: 1.3, tgsFile: 'yellow_purp.tgs' },
    { name: 'Marble', rarity: 'rare', chance: 1.3, tgsFile: 'marble.tgs' },
    { name: 'Fifty Shades', rarity: 'rare', chance: 1.3, tgsFile: 'fifty_shades.tgs' },
    { name: 'Birmingham', rarity: 'rare', chance: 1.3, tgsFile: 'birmingham.tgs' },
    { name: 'Emo Boi', rarity: 'rare', chance: 1.3, tgsFile: 'emo_boi.tgs' },
    { name: 'Santa Pepe', rarity: 'rare', chance: 1.3, tgsFile: 'santa_pepe.tgs' },
    { name: 'Kung Fu Pepe', rarity: 'rare', chance: 1.3, tgsFile: 'kung_fu_pepe.tgs' },
    { name: 'Christmas', rarity: 'rare', chance: 1.3, tgsFile: 'christmas.tgs' },
    { name: 'Amalgam', rarity: 'rare', chance: 1.3, tgsFile: 'amalgam.tgs' },
    { name: 'Stripes', rarity: 'rare', chance: 1.3, tgsFile: 'stripes.tgs' },
    { name: 'Pink Latex', rarity: 'rare', chance: 1.3, tgsFile: 'pink_latex.tgs' },
    { name: 'Frozen', rarity: 'rare', chance: 1.3, tgsFile: 'frozen.tgs' },
    { name: 'Princess', rarity: 'rare', chance: 1.3, tgsFile: 'princess.tgs' },
    { name: 'Hot Head', rarity: 'rare', chance: 1.3, tgsFile: 'hot_head.tgs' },
    { name: 'Cold Heart', rarity: 'rare', chance: 1.3, tgsFile: 'cold_heart.tgs' },
    { name: 'Hue Jester', rarity: 'rare', chance: 1.3, tgsFile: 'hue_jester.tgs' },
    { name: 'Spectrum', rarity: 'rare', chance: 1.3, tgsFile: 'spectrum.tgs' },

    // Common (70% chance total) - 22 models
    { name: 'Ninja Mike', rarity: 'common', chance: 3.2, tgsFile: 'ninja_mike.tgs' },
    { name: 'Raphael', rarity: 'common', chance: 3.2, tgsFile: 'raphael.tgs' },
    { name: 'Bavaria', rarity: 'common', chance: 3.2, tgsFile: 'bavariya.tgs' },
    { name: 'Red Pepple', rarity: 'common', chance: 3.2, tgsFile: 'red_pepple.tgs' },
    { name: 'Louis Vuittoad', rarity: 'common', chance: 3.2, tgsFile: 'louis_vuittoad.tgs' },
    { name: 'Milano', rarity: 'common', chance: 3.2, tgsFile: 'milano.tgs' },
    { name: 'Barcelona', rarity: 'common', chance: 3.2, tgsFile: 'barcelona.tgs' },
    { name: 'Leonardo', rarity: 'common', chance: 3.2, tgsFile: 'leonardo.tgs' },
    { name: 'Donatello', rarity: 'common', chance: 3.2, tgsFile: 'donatello.tgs' },
    { name: 'Two Face', rarity: 'common', chance: 3.2, tgsFile: 'two_face.tgs' },
    { name: 'Yellow Hug', rarity: 'common', chance: 3.2, tgsFile: 'yellow_hug.tgs' },
    { name: 'Pumpkin', rarity: 'common', chance: 3.2, tgsFile: 'pumpkin.tgs' },
    { name: 'Sunset', rarity: 'common', chance: 3.2, tgsFile: 'sunset.tgs' },
    { name: 'Gummy Frog', rarity: 'common', chance: 3.2, tgsFile: 'gummy_frog.tgs' },
    { name: 'Tropical', rarity: 'common', chance: 3.2, tgsFile: 'tropical.tgs' },
    { name: 'Eggplant', rarity: 'common', chance: 3.2, tgsFile: 'eggplant.tgs' },
    { name: 'Pepe La Rana', rarity: 'common', chance: 3.2, tgsFile: 'pepe_la_rana.tgs' },
    { name: 'Pepemint', rarity: 'common', chance: 3.2, tgsFile: 'pepemint.tgs' },
    { name: 'Poison Dart', rarity: 'common', chance: 3.2, tgsFile: 'poison_dart.tgs' },
    { name: 'Puppy Pug', rarity: 'common', chance: 3.2, tgsFile: 'puppy_pug.tgs' },
    { name: 'Red Menace', rarity: 'common', chance: 3.2, tgsFile: 'red_menace.tgs' },
];
