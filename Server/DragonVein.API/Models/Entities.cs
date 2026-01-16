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

        public int InitialLocationId { get; set; } // 初始归属的站点ID (1-5)

        public int? TeamId { get; set; } // 当前归属战队（为空表示未被拾取）
        //记录这张牌是谁获取的
        public int? UserId { get; set; }
    }

    // [新增] 战队-站点进度表 (用于判断首达和限额)
    public class TeamLocationProgress
    {
        public int Id { get; set; }
        public int TeamId { get; set; }
        public int LocationId { get; set; }

        public bool IsFirstArrival { get; set; } // 是否是该站点第一个到达的战队
        public int CardsCollected { get; set; } // 在该站点已领取的卡牌数量
        public DateTime FirstCheckInTime { get; set; }
    }

}