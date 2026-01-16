export const TARGET_LOCATIONS = [
  { id: 1, name: "第一站：玄武门", lat: 32.0722, lng: 118.7909, totalCards: 21, desc: "寻找古城墙的入口" },
  { id: 2, name: "第二站：白马公园", lat: 32.0628, lng: 118.8176, totalCards: 21, desc: "石马面前合影" },
  { id: 3, name: "第三站：中山陵", lat: 32.0617, lng: 118.8496, totalCards: 21, desc: "博爱坊打卡" },
  { id: 4, name: "第四站：明孝陵", lat: 32.0565, lng: 118.8471, totalCards: 21, desc: "神道石像路" },
  { id: 5, name: "终点站：阅江楼", lat: 32.0934, lng: 118.7397, totalCards: 20, desc: "登楼望江，决战时刻" },
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
