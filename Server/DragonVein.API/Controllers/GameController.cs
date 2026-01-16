using System;
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DragonVein.API.Data; // 假设你有 DbContext
using DragonVein.API.Models;

namespace DragonVein.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GameController : ControllerBase
    {
        private readonly AppDbContext _context;

        public GameController(AppDbContext context)
        {
            _context = context;
        }

        // 1. 登录 & 战队分配逻辑
        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequest request)
        {
            // 简单模拟验证，实际应由预制数据决定
            var user = _context.Users.Include(u => u.Team)
                .FirstOrDefault(u => u.Username == request.Username);

            if (user == null) return NotFound("用户不存在");

            bool isFirstLogin = false;

            // 如果用户未分配战队，执行随机分配
            if (user.TeamId == null)
            {
                isFirstLogin = true;
                // 获取所有战队
                var allTeams = _context.Teams.Include(t => t.Members).ToList();
                
                // 简单的负载均衡随机：优先分配给人数最少的队，或者完全随机
                // 这里实现完全随机
                var random = new Random();
                var assignedTeam = allTeams[random.Next(allTeams.Count)];
                
                user.Team = assignedTeam;
                user.TeamId = assignedTeam.Id;
                _context.SaveChanges();
            }

            // 返回 JWT (此处省略具体生成代码) 和用户信息
            return Ok(new 
            { 
                token = "mock_jwt_token", 
                user = new { 
                    user.Id, 
                    user.RealName, 
                    teamId = user.Team.Id,
                    teamName = user.Team.Name,
                    teamEnName = user.Team.EnName,
                    teamDesc = user.Team.Description
                },
                showIntro = isFirstLogin // 前端根据此字段判断是否播放文案
            });
        }
    }

    public class LoginRequest { public string Username { get; set; } }
}