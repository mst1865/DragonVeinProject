export const TARGET_LOCATIONS = [
  { id: 1, name: "白马公园（常遇春墓）", lat: 32.0722, lng: 118.7909, totalCards: 21, desc: "寻找古城墙的入口" },
  { id: 2, name: "琵琶湖（明城墙段）", lat: 31.2977, lng: 121.4538, totalCards: 21, desc: "明城墙·防御界" },
  { id: 3, name: "前湖路/植物园外围", lat: 32.0617, lng: 118.8496, totalCards: 21, desc: "迷雾森林·缓冲区" },
  { id: 4, name: "美龄宫（门口/陵园路）", lat: 32.0565, lng: 118.8471, totalCards: 21, desc: "民国·项链核心" },
  { id: 5, name: "流徽榭（水榭大草坪）", lat: 32.0934, lng: 118.7397, totalCards: 20, desc: "奇点·龙穴重组" },
];

const generateDeck = () => {
  const suits = ['♠', '♥', '♣', '♦'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  let deck = [];
  for (let d = 0; d < 2; d++) {
    for (let s of suits) {
      for (let r of ranks) { deck.push({ id: `${d}-${s}${r}`, suit: s, rank: r, display: `${s}${r}` }); }
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const INITIAL_DECK = generateDeck();

export const MOCK_DB = {
  locationCards: {
    1: INITIAL_DECK.slice(0, 21),
    2: INITIAL_DECK.slice(21, 42),
    3: INITIAL_DECK.slice(42, 63),
    4: INITIAL_DECK.slice(63, 84),
    5: INITIAL_DECK.slice(84, 104),
  },
  locationFirstTeam: { 1: null, 2: null, 3: null, 4: null, 5: null },
  userClaims: {}, teamSiteCounts: {}, teamHands: { 1: [], 2: [], 3: [], 4: [], 5: [] }
};
