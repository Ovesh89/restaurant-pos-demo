/**
 * Green Garden Pure Veg — Restaurant Profile & Menu Catalog
 * Pure Vegetarian Dining & Banquet
 * Address: 101, City Centre, Near Central Park, Sector 11, Gandhinagar - 382010
 * Phone: +91 98765 43210 / +91 98765 43211
 * Email: info@greengardenveg.demo
 */

export const restaurantProfile = {
  name: 'Green Garden Pure Veg',
  tagline: 'Pure Vegetarian Dining & Banquet',
  address: '101, City Centre, Near Central Park, Sector 11, Gandhinagar - 382010',
  phone: '+91 98765 43210',
  phoneNumbers: ['+91 98765 43210', '+91 98765 43211'],
  email: 'info@greengardenveg.demo',
  gstin: '24AABCG1234F1Z8',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  notice: 'Order once placed will not be cancelled. 100% Pure Vegetarian Kitchen.',
};

export const categories = [
  ['cat-soups-veg', 'SOU', 'Soups (Veg)', 'Warm, soothing and delicious vegetarian soups', 1],
  ['cat-starters-veg', 'STR', 'Starters & Appetizers', 'Crispy and flavorful vegetarian finger foods', 2],
  ['cat-tandoor-veg', 'TND-VEG', 'Tandoori Starters (Veg)', 'Charcoal clay oven grilled paneer, vegetables & kebabs', 3],
  ['cat-paneer-se', 'PAN', 'Paneer Main Course', 'Fresh cottage cheese in rich, aromatic Indian gravies', 4],
  ['cat-sabzi-veg', 'SBZ', 'Vegetable Specialties', 'Traditional & royal vegetarian seasonal curries', 5],
  ['cat-kaju-specials', 'KAJ', 'Kaju & Royal Gravies', 'Rich cashew nut curries in creamy makhani gravy', 6],
  ['cat-dal-lentils', 'DAL', 'Dal & Lentils', 'Slow-simmered homestyle & restaurant dal preparations', 7],
  ['cat-rice-biryani', 'RIC', 'Rice & Biryani (Veg)', 'Fragrant Basmati rice, dum biryanis and aromatic pulaos', 8],
  ['cat-tandoori-breads', 'ROTI', 'Tandoori Breads', 'Freshly baked naans, rotis, parathas and kulchas', 9],
  ['cat-chinese-veg', 'CHN', 'Chinese & Noodles (Veg)', 'Wok-tossed noodles, fried rice, manchurian & sizzlers', 10],
  ['cat-salads-papad', 'SAL', 'Salad, Raita & Papad', 'Fresh crunchy salads, cooling raitas and crisp papads', 11],
  ['cat-desserts', 'DES', 'Desserts & Sweets', 'Decadent traditional Indian sweets and ice cream', 12],
  ['cat-beverages', 'BEV', 'Beverages & Mocktails', 'Chilled mocktails, fresh buttermilk, shakes and sodas', 13],
];

export const products = [
  // 1. Soups (Veg)
  ['prod-veg-manchow-soup', 'cat-soups-veg', 'SOU-01', 'Veg Manchow Soup', '130.00', 'CHINESE', 1],
  ['prod-tomato-soup', 'cat-soups-veg', 'SOU-02', 'Cream of Tomato Soup', '120.00', 'MAIN', 2],
  ['prod-sweet-corn-veg-soup', 'cat-soups-veg', 'SOU-03', 'Sweet Corn Veg Soup', '130.00', 'CHINESE', 3],
  ['prod-hot-sour-veg-soup', 'cat-soups-veg', 'SOU-04', 'Hot & Sour Veg Soup', '130.00', 'CHINESE', 4],
  ['prod-lemon-coriander-soup', 'cat-soups-veg', 'SOU-05', 'Lemon Coriander Soup', '140.00', 'MAIN', 5],

  // 2. Starters & Appetizers
  ['prod-crispy-corn', 'cat-starters-veg', 'STR-01', 'Crispy Corn Salt & Pepper', '190.00', 'CHINESE', 1],
  ['prod-cheese-corn-balls', 'cat-starters-veg', 'STR-02', 'Cheese Corn Balls', '220.00', 'MAIN', 2],
  ['prod-hara-bhara-kabab', 'cat-starters-veg', 'STR-03', 'Hara Bhara Kabab', '190.00', 'TANDOOR', 3],
  ['prod-crispy-chilli-babycorn', 'cat-starters-veg', 'STR-04', 'Crispy Chilli Baby Corn', '210.00', 'CHINESE', 4],
  ['prod-veg-spring-rolls', 'cat-starters-veg', 'STR-05', 'Veg Spring Rolls', '180.00', 'CHINESE', 5],
  ['prod-dahi-ke-kebab', 'cat-starters-veg', 'STR-06', 'Dahi Ke Kebab', '240.00', 'TANDOOR', 6],

  // 3. Tandoori Starters (Veg)
  ['prod-paneer-tikka', 'cat-tandoor-veg', 'TND-01', 'Paneer Tikka (Charcoal Grilled)', '260.00', 'TANDOOR', 1],
  ['prod-paneer-malai-tikka', 'cat-tandoor-veg', 'TND-02', 'Paneer Malai Tikka', '280.00', 'TANDOOR', 2],
  ['prod-paneer-achari-tikka', 'cat-tandoor-veg', 'TND-03', 'Paneer Achari Tikka', '270.00', 'TANDOOR', 3],
  ['prod-paneer-pahadi-tikka', 'cat-tandoor-veg', 'TND-04', 'Paneer Pahadi Tikka', '270.00', 'TANDOOR', 4],
  ['prod-tandoori-stuffed-mushroom', 'cat-tandoor-veg', 'TND-05', 'Tandoori Stuffed Mushroom', '260.00', 'TANDOOR', 5],
  ['prod-tandoori-aloo-nazakat', 'cat-tandoor-veg', 'TND-06', 'Tandoori Aloo Nazakat', '220.00', 'TANDOOR', 6],
  ['prod-veg-seekh-kebab', 'cat-tandoor-veg', 'TND-07', 'Veg Seekh Kebab', '230.00', 'TANDOOR', 7],
  ['prod-royal-veg-platter', 'cat-tandoor-veg', 'TND-08', 'Royal Veg Tandoori Platter', '450.00', 'TANDOOR', 8],

  // 4. Paneer Main Course
  ['prod-paneer-butter-masala', 'cat-paneer-se', 'PAN-01', 'Paneer Butter Masala', '270.00', 'MAIN', 1],
  ['prod-kadhai-paneer', 'cat-paneer-se', 'PAN-02', 'Kadhai Paneer', '260.00', 'MAIN', 2],
  ['prod-paneer-tikka-masala', 'cat-paneer-se', 'PAN-03', 'Paneer Tikka Masala', '280.00', 'MAIN', 3],
  ['prod-shahi-paneer', 'cat-paneer-se', 'PAN-04', 'Shahi Paneer (White Gravy)', '280.00', 'MAIN', 4],
  ['prod-palak-paneer', 'cat-paneer-se', 'PAN-05', 'Palak Paneer', '250.00', 'MAIN', 5],
  ['prod-paneer-lababdar', 'cat-paneer-se', 'PAN-06', 'Paneer Lababdar', '290.00', 'MAIN', 6],
  ['prod-paneer-handi', 'cat-paneer-se', 'PAN-07', 'Paneer Handi', '270.00', 'MAIN', 7],
  ['prod-paneer-bhurji', 'cat-paneer-se', 'PAN-08', 'Paneer Bhurji', '290.00', 'MAIN', 8],
  ['prod-paneer-toofani', 'cat-paneer-se', 'PAN-09', 'Paneer Toofani (Spicy Red Gravy)', '280.00', 'MAIN', 9],
  ['prod-paneer-pasanda', 'cat-paneer-se', 'PAN-10', 'Paneer Pasanda', '290.00', 'MAIN', 10],

  // 5. Vegetable Specialties
  ['prod-veg-kolhapuri', 'cat-sabzi-veg', 'SBZ-01', 'Veg Kolhapuri (Spicy)', '230.00', 'MAIN', 1],
  ['prod-veg-handi', 'cat-sabzi-veg', 'SBZ-02', 'Veg Handi', '230.00', 'MAIN', 2],
  ['prod-veg-kadai', 'cat-sabzi-veg', 'SBZ-03', 'Veg Kadhai', '230.00', 'MAIN', 3],
  ['prod-mix-veg-curry', 'cat-sabzi-veg', 'SBZ-04', 'Mixed Vegetable Curry', '220.00', 'MAIN', 4],
  ['prod-dum-aloo-kashmiri', 'cat-sabzi-veg', 'SBZ-05', 'Dum Aloo Kashmiri', '240.00', 'MAIN', 5],
  ['prod-methi-malai-matar', 'cat-sabzi-veg', 'SBZ-06', 'Methi Malai Matar', '260.00', 'MAIN', 6],
  ['prod-amritsari-chana-masala', 'cat-sabzi-veg', 'SBZ-07', 'Amritsari Chana Masala', '210.00', 'MAIN', 7],
  ['prod-malai-kofta', 'cat-sabzi-veg', 'SBZ-08', 'Royal Malai Kofta', '280.00', 'MAIN', 8],
  ['prod-veg-diwani-handi', 'cat-sabzi-veg', 'SBZ-09', 'Veg Diwani Handi', '250.00', 'MAIN', 9],

  // 6. Kaju & Royal Gravies
  ['prod-kaju-curry', 'cat-kaju-specials', 'KAJ-01', 'Kaju Curry', '320.00', 'MAIN', 1],
  ['prod-kaju-butter-masala', 'cat-kaju-specials', 'KAJ-02', 'Kaju Butter Masala', '330.00', 'MAIN', 2],
  ['prod-kaju-paneer-masala', 'cat-kaju-specials', 'KAJ-03', 'Kaju Paneer Masala', '340.00', 'MAIN', 3],
  ['prod-kaju-khoya-sweet', 'cat-kaju-specials', 'KAJ-04', 'Kaju Khoya Sweet Gravy', '330.00', 'MAIN', 4],

  // 7. Dal & Lentils
  ['prod-dal-makhani', 'cat-dal-lentils', 'DAL-01', 'Dal Makhani (Overnight Simmered)', '220.00', 'MAIN', 1],
  ['prod-dal-tadka', 'cat-dal-lentils', 'DAL-02', 'Dal Tadka (Double Jeera Garlic)', '170.00', 'MAIN', 2],
  ['prod-dal-fry', 'cat-dal-lentils', 'DAL-03', 'Dal Fry Butter', '160.00', 'MAIN', 3],
  ['prod-dal-palak', 'cat-dal-lentils', 'DAL-04', 'Dal Palak Tadka', '180.00', 'MAIN', 4],

  // 8. Rice & Biryani (Veg)
  ['prod-veg-hyderabadi-biryani', 'cat-rice-biryani', 'RIC-01', 'Veg Hyderabadi Dum Biryani', '250.00', 'MAIN', 1],
  ['prod-paneer-dum-biryani', 'cat-rice-biryani', 'RIC-02', 'Paneer Dum Biryani', '280.00', 'MAIN', 2],
  ['prod-kashmiri-pulao', 'cat-rice-biryani', 'RIC-03', 'Kashmiri Sweet Pulao', '220.00', 'MAIN', 3],
  ['prod-veg-pulao', 'cat-rice-biryani', 'RIC-04', 'Garden Fresh Veg Pulao', '190.00', 'MAIN', 4],
  ['prod-jeera-rice', 'cat-rice-biryani', 'RIC-05', 'Jeera Rice', '140.00', 'MAIN', 5],
  ['prod-steamed-basmati-rice', 'cat-rice-biryani', 'RIC-06', 'Steamed Basmati Rice', '110.00', 'MAIN', 6],
  ['prod-dal-khichdi', 'cat-rice-biryani', 'RIC-07', 'Dal Khichdi Desi Ghee', '190.00', 'MAIN', 7],

  // 9. Tandoori Breads
  ['prod-tandoori-roti-plain', 'cat-tandoori-breads', 'ROTI-01', 'Tandoori Roti (Plain)', '25.00', 'TANDOOR', 1],
  ['prod-tandoori-roti-butter', 'cat-tandoori-breads', 'ROTI-02', 'Tandoori Roti (Butter)', '30.00', 'TANDOOR', 2],
  ['prod-butter-naan', 'cat-tandoori-breads', 'ROTI-03', 'Butter Naan', '55.00', 'TANDOOR', 3],
  ['prod-garlic-butter-naan', 'cat-tandoori-breads', 'ROTI-04', 'Garlic Butter Naan', '75.00', 'TANDOOR', 4],
  ['prod-cheese-garlic-naan', 'cat-tandoori-breads', 'ROTI-05', 'Cheese Garlic Naan', '110.00', 'TANDOOR', 5],
  ['prod-lachha-paratha', 'cat-tandoori-breads', 'ROTI-06', 'Lachha Paratha', '60.00', 'TANDOOR', 6],
  ['prod-missi-roti', 'cat-tandoori-breads', 'ROTI-07', 'Missi Roti', '50.00', 'TANDOOR', 7],
  ['prod-stuffed-kulcha', 'cat-tandoori-breads', 'ROTI-08', 'Stuffed Aloo Onion Kulcha', '80.00', 'TANDOOR', 8],

  // 10. Chinese & Noodles (Veg)
  ['prod-veg-hakka-noodles', 'cat-chinese-veg', 'CHN-01', 'Veg Hakka Noodles', '180.00', 'CHINESE', 1],
  ['prod-chilli-garlic-noodles', 'cat-chinese-veg', 'CHN-02', 'Chilli Garlic Noodles', '190.00', 'CHINESE', 2],
  ['prod-veg-fried-rice', 'cat-chinese-veg', 'CHN-03', 'Veg Fried Rice', '180.00', 'CHINESE', 3],
  ['prod-schezwan-fried-rice', 'cat-chinese-veg', 'CHN-04', 'Schezwan Veg Fried Rice', '200.00', 'CHINESE', 4],
  ['prod-veg-manchurian-dry', 'cat-chinese-veg', 'CHN-05', 'Veg Manchurian Dry', '190.00', 'CHINESE', 5],
  ['prod-veg-manchurian-gravy', 'cat-chinese-veg', 'CHN-06', 'Veg Manchurian Gravy', '200.00', 'CHINESE', 6],
  ['prod-chilli-paneer-dry', 'cat-chinese-veg', 'CHN-07', 'Chilli Paneer Dry', '240.00', 'CHINESE', 7],
  ['prod-chilli-paneer-gravy', 'cat-chinese-veg', 'CHN-08', 'Chilli Paneer Gravy', '250.00', 'CHINESE', 8],

  // 11. Salad, Raita & Papad
  ['prod-roasted-papad', 'cat-salads-papad', 'SAL-01', 'Roasted Papad', '30.00', 'MAIN', 1],
  ['prod-fried-papad', 'cat-salads-papad', 'SAL-02', 'Fried Papad', '40.00', 'MAIN', 2],
  ['prod-masala-papad', 'cat-salads-papad', 'SAL-03', 'Masala Papad', '60.00', 'MAIN', 3],
  ['prod-cheese-masala-papad', 'cat-salads-papad', 'SAL-04', 'Cheese Masala Papad', '90.00', 'MAIN', 4],
  ['prod-green-salad', 'cat-salads-papad', 'SAL-05', 'Fresh Green Salad', '70.00', 'MAIN', 5],
  ['prod-boondi-raita', 'cat-salads-papad', 'SAL-06', 'Boondi Raita', '90.00', 'MAIN', 6],
  ['prod-veg-raita', 'cat-salads-papad', 'SAL-07', 'Mix Veg Raita', '100.00', 'MAIN', 7],
  ['prod-pineapple-raita', 'cat-salads-papad', 'SAL-08', 'Pineapple Sweet Raita', '120.00', 'MAIN', 8],

  // 12. Desserts & Sweets
  ['prod-gulab-jamun', 'cat-desserts', 'DES-01', 'Gulab Jamun (2 pcs)', '80.00', 'MAIN', 1],
  ['prod-gulab-jamun-icecream', 'cat-desserts', 'DES-02', 'Hot Gulab Jamun with Ice Cream', '130.00', 'MAIN', 2],
  ['prod-rasmalai', 'cat-desserts', 'DES-03', 'Kesar Rasmalai (2 pcs)', '110.00', 'MAIN', 3],
  ['prod-sizzling-brownie', 'cat-desserts', 'DES-04', 'Sizzling Brownie with Ice Cream', '190.00', 'MAIN', 4],
  ['prod-vanilla-icecream', 'cat-desserts', 'DES-05', 'Vanilla Ice Cream Scoop', '70.00', 'MAIN', 5],

  // 13. Beverages & Mocktails
  ['prod-masala-chaas', 'cat-beverages', 'BEV-01', 'Gujarati Masala Chaas', '35.00', 'BEVERAGES', 1],
  ['prod-sweet-lassi', 'cat-beverages', 'BEV-02', 'Punjabi Sweet Lassi', '80.00', 'BEVERAGES', 2],
  ['prod-fresh-lime-soda', 'cat-beverages', 'BEV-03', 'Fresh Lime Soda (Sweet/Salt)', '70.00', 'BEVERAGES', 3],
  ['prod-virgin-mojito', 'cat-beverages', 'BEV-04', 'Virgin Mint Mojito', '120.00', 'BEVERAGES', 4],
  ['prod-cold-coffee', 'cat-beverages', 'BEV-05', 'Cold Coffee with Ice Cream', '130.00', 'BEVERAGES', 5],
  ['prod-packaged-water', 'cat-beverages', 'BEV-06', 'Packaged Drinking Water 1L', '30.00', 'BEVERAGES', 6],
  ['prod-soft-drink-can', 'cat-beverages', 'BEV-07', 'Soft Drink Can (300ml)', '50.00', 'BEVERAGES', 7],
];
