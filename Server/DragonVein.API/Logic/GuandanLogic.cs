using System;
using System.Collections.Generic;
using System.Linq;
using DragonVein.API.Models;

namespace DragonVein.API.Logic
{
    public enum HandType
    {
        None,

        // --- 基础牌型 ---
        Single,         // 单张
        Pair,           // 对子
        Triple,         // 三张 (一般作为剩余牌出，或者接三带二)
        TripleWithPair, // 三带二 (Full House)
        // --- 连续牌型 (掼蛋特色) ---
        Straight,       // 顺子 (5张)
        Tube,           // 连对/木板 (3连对, 如 334455)
        Plate,          // 钢板 (2连三张, 如 333444)
        // --- 炸弹类 (权重依次增加) ---
        Bomb,           // 普通炸弹 (4张及以上)
        StraightFlush,  // 同花顺 (5张同花色连续)
        KingBomb        // 四大天王 (4张王)
    }

    public class HandInfo
    {
        public HandType Type { get; set; }
        public int Value { get; set; } // 主值 (比较大小用)
        public int Count { get; set; } // 张数 (用于炸弹比较)
        public int Level { get; set; } // 炸弹等级 (用于区分 4炸/5炸/同花顺)
    }

    public static class GuandanLogic
    {
        // 掼蛋核心数值：2=15, A=14, K=13 ... 3=3
        // 大王=20, 小王=19
        // 注意：如果你有“级牌”（比如打几），级牌应该是在大王小王之下，2之上。这里暂按打2处理。
        private static int GetCardValue(string rank)
        {
            if (rank == "RJ") return 20;
            if (rank == "BJ") return 19;
            if (rank == "2") return 15;
            if (rank == "A") return 14;
            if (rank == "K") return 13;
            if (rank == "Q") return 12;
            if (rank == "J") return 11;
            if (int.TryParse(rank, out int val)) return val;
            return 0;
        }

        public static HandInfo AnalyzeHand(List<Card> cards)
        {
            if (cards == null || cards.Count == 0) return new HandInfo { Type = HandType.None };

            // 预处理：排序、分组
            var sorted = cards.OrderByDescending(c => GetCardValue(c.Rank)).ToList();
            var values = sorted.Select(c => GetCardValue(c.Rank)).ToList();

            // GroupBy 分组统计： Key=点数, Count=张数
            var groups = values.GroupBy(v => v)
                               .Select(g => new { Val = g.Key, Count = g.Count() })
                               .OrderByDescending(g => g.Count) // 张数多的在前 (比如3带2，3张的在前)
                               .ThenByDescending(g => g.Val)    // 张数一样大的在前
                               .ToList();

            int count = cards.Count;

            // ==================== 1. 特殊炸弹判断 ====================

            // 四大天王
            if (count == 4 && values.All(v => v >= 19))
                return new HandInfo { Type = HandType.KingBomb, Value = 999, Level = 99 };

            // 普通炸弹 (4张及以上，且只有一种点数)
            if (count >= 4 && groups.Count == 1)
            {
                // 炸弹等级：张数越多越大
                return new HandInfo { Type = HandType.Bomb, Value = groups[0].Val, Count = count, Level = count };
            }

            // 同花顺 (5张，同花色，连续)
            bool isFlush = cards.All(c => c.Suit == cards[0].Suit);
            if (count == 5 && isFlush && IsStraight(values, out int maxFlushVal))
            {
                // 同花顺比5炸大，比6炸小，设定 Level = 5.5 或者 10(根据具体规则)
                // 掼蛋规则：同花顺 > 5炸
                return new HandInfo { Type = HandType.StraightFlush, Value = maxFlushVal, Count = 5, Level = 6 }; // 这里Level定为6，代表它大于5炸
            }

            // ==================== 2. 常规牌型判断 ====================

            switch (count)
            {
                case 1: // 单张
                    return new HandInfo { Type = HandType.Single, Value = groups[0].Val };

                case 2: // 对子
                    if (groups[0].Count == 2)
                        return new HandInfo { Type = HandType.Pair, Value = groups[0].Val };
                    break;

                case 3: // 三张
                    if (groups[0].Count == 3)
                        return new HandInfo { Type = HandType.Triple, Value = groups[0].Val };
                    break;

                case 5: // 5张牌 (顺子 / 三带二)
                    // 三带二
                    if (groups.Count == 2 && groups[0].Count == 3 && groups[1].Count == 2)
                    {
                        return new HandInfo { Type = HandType.TripleWithPair, Value = groups[0].Val };
                    }
                    // 顺子 (杂花)
                    if (groups.Count == 5 && IsStraight(values, out int straightMax))
                    {
                        return new HandInfo { Type = HandType.Straight, Value = straightMax };
                    }
                    break;

                case 6: // 6张牌 (钢板 / 连对)
                    // 钢板 (两个连续的三张，如 333444)
                    // groups 应该是 [{Val:4, Count:3}, {Val:3, Count:3}]
                    if (groups.Count == 2 && groups[0].Count == 3 && groups[1].Count == 3)
                    {
                        if (IsConsecutive(groups[0].Val, groups[1].Val))
                        {
                            // 取较大的那个值
                            return new HandInfo { Type = HandType.Plate, Value = Math.Max(groups[0].Val, groups[1].Val) };
                        }
                    }

                    // 连对/木板 (三个连续的对子，如 334455)
                    // groups 应该是 3个，每个Count=2
                    if (groups.Count == 3 && groups.All(g => g.Count == 2))
                    {
                        // 提取所有点数，看是否连续
                        var pairValues = groups.Select(g => g.Val).OrderBy(v => v).ToList();
                        if (IsConsecutiveList(pairValues))
                        {
                            return new HandInfo { Type = HandType.Tube, Value = pairValues.Max() };
                        }
                    }
                    break;
            }

            return new HandInfo { Type = HandType.None };
        }

        // --- 辅助方法 ---

        // 判断顺子 (A2345 特殊处理)
        private static bool IsStraight(List<int> values, out int maxVal)
        {
            maxVal = 0;
            var distinct = values.Distinct().OrderBy(v => v).ToList();
            if (distinct.Count != 5) return false;

            // 情况1: 普通顺子 (如 34567, 10JQKA)
            // A=14, K=13...
            if (distinct.Last() - distinct.First() == 4)
            {
                maxVal = distinct.Last();
                return true;
            }

            // 情况2: A2345 (掼蛋中 A在顺子里可以做最小)
            // 此时 values 应该是 [14, 15, 3, 4, 5] (如果2=15, A=14)
            // 或者如果不打2，是 [14, 2, 3, 4, 5]
            // 这里的判断需要根据你 GetCardValue 的定义。
            // 假设 2=15, A=14。A2345 的 values 是 {15, 14, 5, 4, 3}
            bool hasA = values.Contains(14);
            bool has2 = values.Contains(15);
            bool has3 = values.Contains(3);
            bool has4 = values.Contains(4);
            bool has5 = values.Contains(5);

            if (hasA && has2 && has3 && has4 && has5)
            {
                maxVal = 5; // A2345 中 5 最大
                return true;
            }

            return false;
        }

        // 判断两个数是否连续 (需考虑 A和2 的特殊连续性吗？钢板一般只认 234..A，A23钢板很少见，这里按数值连续判断)
        private static bool IsConsecutive(int v1, int v2)
        {
            return Math.Abs(v1 - v2) == 1;
        }

        // 判断列表是否连续
        private static bool IsConsecutiveList(List<int> vals)
        {
            for (int i = 0; i < vals.Count - 1; i++)
            {
                if (vals[i + 1] - vals[i] != 1) return false;
            }
            return true;
        }

        // 比大小核心逻辑
        public static bool CanBeat(HandInfo newHand, HandInfo lastHand)
        {
            if (newHand.Type == HandType.None) return false;
            if (lastHand == null || lastHand.Type == HandType.None) return true;

            // 1. 都是天王炸
            if (newHand.Type == HandType.KingBomb && lastHand.Type == HandType.KingBomb) return false; // 先出为大? 通常4王是最大的，后出打不过先出，或者不允许
            if (newHand.Type == HandType.KingBomb) return true;
            if (lastHand.Type == HandType.KingBomb) return false;

            // 2. 炸弹比较 (包括同花顺)
            bool newIsBomb = IsBomb(newHand);
            bool lastIsBomb = IsBomb(lastHand);

            if (newIsBomb && !lastIsBomb) return true; // 炸弹吃普通牌
            if (!newIsBomb && lastIsBomb) return false;

            if (newIsBomb && lastIsBomb)
            {
                // 炸弹比大小规则：
                // 等级高的赢 (6炸 > 同花顺 > 5炸 > 4炸)
                // 等级相同比点数
                if (newHand.Level > lastHand.Level) return true;
                if (newHand.Level < lastHand.Level) return false;
                return newHand.Value > lastHand.Value;
            }

            // 3. 普通牌型：必须同类型、同张数、比点数
            if (newHand.Type != lastHand.Type) return false;
            if (newHand.Count != lastHand.Count && newHand.Type != HandType.Single && newHand.Type != HandType.Pair) return false;
            // 注意：连对和钢板都是6张，类型已区分，直接比Value

            return newHand.Value > lastHand.Value;
        }

        private static bool IsBomb(HandInfo h)
        {
            return h.Type == HandType.Bomb || h.Type == HandType.StraightFlush || h.Type == HandType.KingBomb;
        }
    }
}