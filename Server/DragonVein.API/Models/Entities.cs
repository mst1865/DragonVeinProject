using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace DragonVein.API.Models
{
    public class User
    {
        public int Id { get; set; }
        [Required]
        public string Username { get; set; }
        public string RealName { get; set; }
        public int? TeamId { get; set; }
        [JsonIgnore] // 防止循环引用
        public Team Team { get; set; }
        public DateTime? LastCheckInTime { get; set; }
        public bool IsCaptain { get; set; }
        // 位置信息
        public double? Lat { get; set; }
        public double? Lng { get; set; }
        public DateTime? LastActiveTime { get; set; } // 最后活跃时间
    }

    public class Team
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string EnName { get; set; }
        public string Description { get; set; }

        [JsonIgnore]
        public List<User> Members { get; set; }

        // 战队拥有的卡牌
        public List<Card> Cards { get; set; }
        // 碎片计数
        public int FragmentCount { get; set; }
    }

    // 站点/打卡点实体
    public class Location
    {
        public int Id { get; set; }
        public string Name { get; set; }   // 站点名称
        public string Sub { get; set; }    // 副标题/描述
        public double Lat { get; set; }    // 纬度
        public double Lng { get; set; }    // 经度
        public int Radius { get; set; }    // 判定半径 (米)
    }
    // [新增] 扑克牌实体
    public class Card
    {
        public int Id { get; set; }

        [Required]
        public string Suit { get; set; } // 花色：♠, ♥, ♣, ♦

        [Required]
        public string Rank { get; set; } // 点数：A, 2-10, J, Q, K

        public string Display { get; set; } // 前端展示用，如 "♠A"
        public bool IsWildGenerated { get; set; }


        public int? TeamId { get; set; } // 当前归属战队（为空表示未被拾取）
        //记录这张牌是谁获取的
        public int? UserId { get; set; }
        // 记录这张牌是从哪个站点抽出来的
        public int? OriginLocationId { get; set; }
        public bool IsPlayed { get; set; }
    }

    // 道具类型枚举
    public enum ItemType
    {
        Wild,       // 通配牌
        Swap,       // 调换牌
        Fragment,   // 碎片牌
        Gift        // 礼品牌
    }
    // 道具牌实体
    public class ItemCard
    {
        public int Id { get; set; }
        public ItemType Type { get; set; }
        public string Name { get; set; } // "通配牌", "调换牌"...
        public string Description { get; set; }

        public int? UserId { get; set; }
        public int? TeamId { get; set; }
        // 记录这个道具是从哪个站点抽出来的
        public int? OriginLocationId { get; set; }
        public bool IsUsed { get; set; } // 是否已使用
    }

    public class TableState
    {
        public int Id { get; set; }

        // 擂主战队信息
        public int LastTeamId { get; set; }
        public string LastTeamName { get; set; }

        // 牌型数据 (用于比大小)
        public int LastHandType { get; set; }   // 对应 enum HandType 的整数值
        public int LastHandValue { get; set; }
        public int LastHandCount { get; set; }
        public int LastHandLevel { get; set; }

        // 视觉数据：直接存 JSON 字符串，方便前端还原显示，不用去查 Card 表
        // 格式：[{"suit":"♠","rank":"A","isWild":false}, ...]
        public string LastCardsJson { get; set; }
    }

}