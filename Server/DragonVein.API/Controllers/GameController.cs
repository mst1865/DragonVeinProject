using System;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Configuration;
using DragonVein.API.Data;
using DragonVein.API.Models;

namespace DragonVein.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GameController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        public GameController(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        // --- 1. 登录 (验证工号+姓名) ---
        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequest request)
        {
            var user = _context.Users.Include(u => u.Team)
                .FirstOrDefault(u => u.Username == request.Username && u.RealName == request.RealName);

            if (user == null) return NotFound("工号或姓名错误，请检查输入。");

            // 生成 Token
            var token = GenerateJwtToken(user);

            // 返回用户信息 (此时 TeamId 可能为 null)
            return Ok(new
            {
                token = token,
                user = new
                {
                    user.Id,
                    user.RealName,
                    user.Username,
                    teamId = user.Team?.Id,          // 可能为 null
                    teamName = user.Team?.Name,      // 可能为 null
                    teamDesc = user.Team?.Description,
                    isCaptain = user.Username.EndsWith("01")
                }
            });
        }

        // --- 2. 分配战队 (新接口：点击屏幕时调用) ---
        [HttpPost("assign-team")]
        [Authorize] // 必须登录
        public IActionResult AssignTeam()
        {
            // 1. 获取当前用户 ID
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "id")?.Value;
            if (userIdClaim == null) return Unauthorized();
            int userId = int.Parse(userIdClaim);

            var user = _context.Users.Include(u => u.Team).FirstOrDefault(u => u.Id == userId);
            if (user == null) return NotFound("用户不存在");

            // 2. 幂等性检查：如果已有战队，直接返回现有战队
            if (user.TeamId != null)
            {
                return Ok(new
                {
                    teamId = user.Team.Id,
                    teamName = user.Team.Name,
                    teamDesc = user.Team.Description
                });
            }

            // 3. 执行随机分配逻辑
            var allTeams = _context.Teams.ToList();
            var random = new Random();
            var assignedTeam = allTeams[random.Next(allTeams.Count)];

            user.Team = assignedTeam;
            user.TeamId = assignedTeam.Id;
            _context.SaveChanges();

            return Ok(new
            {
                teamId = assignedTeam.Id,
                teamName = assignedTeam.Name,
                teamDesc = assignedTeam.Description
            });
        }

        // --- 2. 自动登录 (通过 Token 获取当前用户) ---
        [HttpGet("me")]
        [Authorize] // 只有携带有效 JWT 才能访问
        public IActionResult GetMe()
        {
            // 从 Token Claims 中解析 UserId
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "id")?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();

            int userId = int.Parse(userIdClaim);
            var user = _context.Users.Include(u => u.Team).FirstOrDefault(u => u.Id == userId);

            if (user == null) return Unauthorized();

            return Ok(new
            {
                user = new
                {
                    user.Id,
                    user.RealName,
                    user.Username,
                    teamId = user.Team?.Id,
                    teamName = user.Team?.Name,
                    teamDesc = user.Team?.Description,
                    isCaptain = user.Username.EndsWith("01")
                }
            });
        }

        // 辅助方法：生成 JWT
        private string GenerateJwtToken(User user)
        {
            var keyStr = _configuration["Jwt:Key"];
            var issuer = _configuration["Jwt:Issuer"];
            var audience = _configuration["Jwt:Audience"];

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyStr));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim("id", user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Sub, user.Username)
            };

            var token = new JwtSecurityToken(
                issuer: issuer,       // 使用配置项
                audience: audience,   // 使用配置项
                claims: claims,
                expires: DateTime.Now.AddDays(7),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        // [新增] 获取团队所有卡牌 (用于卡库展示)
        [HttpGet("team-cards")]
        [Authorize]
        public IActionResult GetTeamCards()
        {
            var userIdStr = User.Claims.FirstOrDefault(c => c.Type == "id")?.Value;
            if (userIdStr == null) return Unauthorized();
            int userId = int.Parse(userIdStr);

            var user = _context.Users.Find(userId);
            if (user.TeamId == null) return BadRequest("未加入战队");

            // 获取该战队的所有卡牌
            var cards = _context.Cards
                .Where(c => c.TeamId == user.TeamId)
                .OrderBy(c => c.InitialLocationId) // 或者是按点数排序
                .ToList();

            return Ok(cards);
        }

        // [新增] 抽卡接口
        [HttpPost("draw")]
        [Authorize] // 需要登录
        public IActionResult DrawCard([FromBody] DrawRequest request)
        {
            // 1. 获取当前用户和战队
            var userIdStr = User.Claims.FirstOrDefault(c => c.Type == "id")?.Value;
            if (userIdStr == null) return Unauthorized();
            int userId = int.Parse(userIdStr);

            var user = _context.Users.Find(userId);
            if (user.TeamId == null) return BadRequest("您还没有加入战队！");
            int teamId = user.TeamId.Value;

            // 开启事务，防止多个人同时抢最后一张牌或抢首达
            using var transaction = _context.Database.BeginTransaction();
            try
            {
                // 1. 检查个人限制：一个人在一个站点只能拿一张
                bool hasCardHere = _context.Cards.Any(c =>
                    c.InitialLocationId == request.LocationId &&
                    c.UserId == userId); // 检查该站点是否有该用户的记录

                if (hasCardHere)
                {
                    return BadRequest("每人每站限领一张！\n您已在此处获得过线索卡。");
                }
                // 2. 获取该战队在此站点的进度
                var progress = _context.TeamLocationProgresses
                    .FirstOrDefault(p => p.TeamId == teamId && p.LocationId == request.LocationId);

                // 如果是第一次来这个站点
                if (progress == null)
                {
                    progress = new TeamLocationProgress
                    {
                        TeamId = teamId,
                        LocationId = request.LocationId,
                        CardsCollected = 0,
                        IsFirstArrival = false,
                        FirstCheckInTime = DateTime.Now
                    };

                    // 3. 【规则】判断是否是全服第一个到达该站点的战队
                    // 检查数据库里有没有其他战队在这个站点的记录
                    bool anyoneBeenHere = _context.TeamLocationProgresses
                        .Any(p => p.LocationId == request.LocationId);

                    if (!anyoneBeenHere)
                    {
                        progress.IsFirstArrival = true; // 恭喜，你们是第一名
                    }

                    _context.TeamLocationProgresses.Add(progress);
                    _context.SaveChanges(); // 先保存进度状态
                }

                // 4. 【规则】计算最大可拿牌数
                // 基础4张。如果是前4站(ID<=4)且是首达，则为5张。
                int maxCards = 4;
                if (request.LocationId <= 4 && progress.IsFirstArrival)
                {
                    maxCards = 5;
                }

                if (progress.CardsCollected >= maxCards)
                {
                    return BadRequest($"本站点资源已耗尽！\n你们战队已获取 {progress.CardsCollected}/{maxCards} 张线索卡。");
                }

                // 5. 【规则】随机抽取一张属于该站点且未被拿走的牌
                // OrderBy(Guid.NewGuid()) 是数据库层面的随机排序
                var card = _context.Cards
                    .Where(c => c.InitialLocationId == request.LocationId && c.TeamId == null)
                    .OrderBy(c => Guid.NewGuid())
                    .FirstOrDefault();

                if (card == null)
                {
                    return BadRequest("来晚一步，该站点的所有卡牌已被搜刮一空！");
                }

                // 6. 更新数据
                card.TeamId = teamId; // 标记归属
                card.UserId = userId;
                progress.CardsCollected++; // 计数+1

                _context.SaveChanges();
                transaction.Commit();

                return Ok(new
                {
                    card = card,
                    message = "获取成功",
                    progress = new
                    {
                        collected = progress.CardsCollected,
                        max = maxCards,
                        isFirstBonus = (maxCards == 5)
                    }
                });
            }
            catch (Exception ex)
            {
                transaction.Rollback();
                return StatusCode(500, "时空裂缝波动，获取失败: " + ex.Message);
            }
        }

        // --- 3. 队长视图：查看战队手牌 ---
        [HttpGet("teamCards/{teamId}")]
        public IActionResult GetTeamCards(int teamId)
        {
            var cards = _context.Cards
                .Where(c => c.TeamId == teamId)
                .OrderBy(c => c.Rank) // 简单排序，实际可能需要按花色+点数排
                .ToList();

            // 统计收集进度
            var totalCollected = cards.Count;
            // 理论最大值：4站*4 + 1站*4 + 首达奖励(最多4) = 20~24张左右

            return Ok(new
            {
                count = totalCollected,
                cards = cards
            });
        }

        [HttpGet("locations")]
        public IActionResult GetLocations()
        {
            var list = _context.Locations.OrderBy(x => x.Id).ToList();
            return Ok(list);
        }

        // [新增] 上传我的位置 (心跳包)
        [HttpPost("location")]
        [Authorize]
        public IActionResult UpdateLocation([FromBody] LocationUpdateDto dto)
        {
            var userId = int.Parse(User.Claims.First(c => c.Type == "id").Value);
            var user = _context.Users.Find(userId);
            if (user == null) return Unauthorized();

            user.Lat = dto.Lat;
            user.Lng = dto.Lng;
            user.LastActiveTime = DateTime.UtcNow; // 更新活跃时间

            _context.SaveChanges();
            return Ok();
        }

        // [新增] 获取全员位置 (用于地图展示)
        [HttpGet("locations/all")]
        [Authorize]
        public IActionResult GetAllUserLocations()
        {
            // 只返回最近 5 分钟活跃的用户，避免显示僵尸位置
            var activeTime = DateTime.UtcNow.AddMinutes(-5);

            var users = _context.Users
                .Where(u => u.Lat != null && u.Lng != null && u.LastActiveTime >= activeTime)
                .Select(u => new
                {
                    u.Id,
                    u.RealName,
                    u.TeamId,
                    Lat = u.Lat.Value,
                    Lng = u.Lng.Value
                })
                .ToList();

            return Ok(users);
        }


    }

    public class LoginRequest
    {
        public string Username { get; set; }
        public string RealName { get; set; } 
    }

    public class DrawRequest
    {
        public int LocationId { get; set; }
    }
    public class LocationUpdateDto
    {
        public double Lat { get; set; }
        public double Lng { get; set; }
    }



}