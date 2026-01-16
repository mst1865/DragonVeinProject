using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace DragonVein.API.Models
{
    public class User
    {
        public int Id { get; set; }
        [Required]
        public string Username { get; set; } // 登录用，预制数据
        public string RealName { get; set; }
        public int? TeamId { get; set; } //这也是 int? 表示可空，未分配时为 null
        public Team Team { get; set; }
        public DateTime? LastCheckInTime { get; set; }
    }

    public class Team
    {
        public int Id { get; set; }
        public string Name { get; set; } // 中文名
        public string EnName { get; set; } // 英文名
        public string Description { get; set; } // 人设
        public List<User> Members { get; set; }
    }
}