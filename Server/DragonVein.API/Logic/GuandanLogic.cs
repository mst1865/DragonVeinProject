using System;
using System.Collections.Generic;
using System.Linq;
using DragonVein.API.Models;

namespace DragonVein.API.Logic
{
    public enum HandType
    {
        None,
        Single,         // 单张
        Pair,           // 对子
        Triple,         // 三张
        TripleWithPair, // 三带二 (Full House)
        Plate,          // 钢板 (两个连续三张) - 简化版暂不支持或视同Tube
        Tube,           // 连对 (三连对) - 简化版暂不支持
        Straight,       // 顺子 (5张)
        Bomb,           // 炸弹 (4张及以上)
        StraightFlush,  // 同花顺
        KingBomb        // 四大天王 (4张王)
    }

    public class HandInfo
    {
        public HandType Type { get; set; }
        public int Value { get; set; } // 比较权值
        public int Count { get; set; } // 张数 (用于炸弹比较)
    }

    public static class GuandanLogic
    {
        // 牌力映射：2=15 (级牌), A=14, K=13 ... 3=3
        // 大小王 > 16
        private static int GetCardValue(string rank, string suit)
        {
            if (rank == "RJ") return 20; // 大王
            if (rank == "BJ") return 19; // 小王
            if (rank == "2") return 15;  // 级牌 (默认打2)
            if (rank == "A") return 14;
            if (rank == "K") return 13;
            if (rank == "Q") return 12;
            if (rank == "J") return 11;
            // 10-3
            if (int.TryParse(rank, out int val)) return val;
            return 0;
        }

        public static HandInfo AnalyzeHand(List<Card> cards)
        {
            if (cards == null || cards.Count == 0) return new HandInfo { Type = HandType.None };

            var sorted = cards.OrderByDescending(c => GetCardValue(c.Rank, c.Suit)).ToList();
            var values = sorted.Select(c => GetCardValue(c.Rank, c.Suit)).ToList();
            var counts = values.GroupBy(v => v).ToDictionary(g => g.Key, g => g.Count());
            int maxCount = counts.Values.Max(); // 最多重复了几张
            int maxVal = counts.Where(x => x.Value == maxCount).Max(x => x.Key); // 重复最多的那个点数

            // 1. 四大天王
            if (cards.Count == 4 && values.All(v => v >= 19))
                return new HandInfo { Type = HandType.KingBomb, Value = 999, Count = 4 };

            // 2. 炸弹 (4张及以上)
            // 掼蛋规则：同花顺 > 6+炸 > 5炸 > 4炸
            if (cards.Count >= 4 && counts.Count == 1) // 纯炸弹
            {
                return new HandInfo { Type = HandType.Bomb, Value = values[0], Count = cards.Count };
            }
            // 2.1 同花顺 (5张)
            if (cards.Count == 5 && IsStraight(values) && cards.All(c => c.Suit == cards[0].Suit))
            {
                return new HandInfo { Type = HandType.StraightFlush, Value = values[0], Count = 5 };
            }

            // --- 以下是非炸弹牌型 ---

            // 3. 单张
            if (cards.Count == 1) return new HandInfo { Type = HandType.Single, Value = values[0] };

            // 4. 对子
            if (cards.Count == 2 && maxCount == 2) return new HandInfo { Type = HandType.Pair, Value = values[0] };

            // 5. 三张 (不带)
            if (cards.Count == 3 && maxCount == 3) return new HandInfo { Type = HandType.Triple, Value = values[0] };

            // 6. 三带二 (Full House)
            if (cards.Count == 5 && maxCount == 3 && counts.Count == 2) // 3+2
            {
                // 3张的那个点数决定大小
                return new HandInfo { Type = HandType.TripleWithPair, Value = maxVal };
            }

            // 7. 顺子 (5张)
            if (cards.Count == 5 && maxCount == 1 && IsStraight(values))
            {
                // A2345 (A=1, 2=2...) 特殊处理，或者 A在顺子里算小
                // 简化：按最大牌算
                return new HandInfo { Type = HandType.Straight, Value = values[0] };
            }

            return new HandInfo { Type = HandType.None };
        }

        private static bool IsStraight(List<int> values)
        {
            // 简化判断：最大-最小=4 且无重复
            // 注意：掼蛋中 A2345 是合法的，这里 A=14, 2=15 需要特殊映射回 1, 2
            // 暂只支持标准顺子 10-J-Q-K-A
            return (values.Max() - values.Min() == 4) && values.Distinct().Count() == 5;
        }

        // 核心：比大小
        public static bool CanBeat(HandInfo newHand, HandInfo lastHand)
        {
            if (newHand.Type == HandType.None) return false;

            // 1. 如果上家没出(空)，这把随便出
            if (lastHand == null || lastHand.Type == HandType.None) return true;

            // 2. 炸弹压制
            bool newIsBomb = IsBomb(newHand);
            bool lastIsBomb = IsBomb(lastHand);

            if (newIsBomb && !lastIsBomb) return true;
            if (!newIsBomb && lastIsBomb) return false;
            if (newIsBomb && lastIsBomb) return CompareBombs(newHand, lastHand);

            // 3. 普通牌型：必须同类型且张数相同
            if (newHand.Type != lastHand.Type) return false;
            if (newHand.Count != lastHand.Count) return false;

            // 4. 比点数
            return newHand.Value > lastHand.Value;
        }

        private static bool IsBomb(HandInfo h)
        {
            return h.Type == HandType.Bomb || h.Type == HandType.StraightFlush || h.Type == HandType.KingBomb;
        }

        private static bool CompareBombs(HandInfo a, HandInfo b)
        {
            // 天王炸最大
            if (a.Type == HandType.KingBomb) return true;
            if (b.Type == HandType.KingBomb) return false;

            // 同花顺 > 普通炸 (掼蛋规则：6炸 > 同花顺 > 5炸，这里简化为 同花顺 > 5炸)
            // 假设：同花顺权级 = 5.5炸

            // 简单逻辑：张数优先
            if (a.Count > b.Count) return true;
            if (a.Count < b.Count) return false;

            // 张数相同比点数
            return a.Value > b.Value;
        }
    }
}