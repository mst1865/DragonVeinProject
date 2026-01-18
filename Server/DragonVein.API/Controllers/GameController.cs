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
using System.Collections.Generic;
using DragonVein.API.Logic;
using System.Text.Json;

namespace DragonVein.API.Controllers
{
    // [新增] 简单的内存状态 (为了持久化建议存数据库，这里简化演示)
    public static class GameState
    {
        public static List<Card> LastPlayedCards = new List<Card>();
        public static HandInfo LastHandInfo = new HandInfo();
        public static int LastPlayerTeamId = 0;
        public static string LastPlayerTeamName = "";
    }

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
                    isCaptain = user.IsCaptain
                }
            });
        }

        // --- 2. 分配战队 (新接口：点击屏幕时调用) ---
        // --- 2. 分配战队 (智能平衡版) ---
        [HttpPost("assign-team")]
        [Authorize]
        public IActionResult AssignTeam()
        {
            // 1. 获取当前用户
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "id")?.Value;
            if (userIdClaim == null) return Unauthorized();
            int userId = int.Parse(userIdClaim);

            var user = _context.Users.Include(u => u.Team).FirstOrDefault(u => u.Id == userId);
            if (user == null) return NotFound("用户不存在");

            // 2. 幂等性检查：如果已有战队，直接返回
            if (user.TeamId != null)
            {
                return Ok(new
                {
                    teamId = user.Team.Id,
                    teamName = user.Team.Name,
                    teamDesc = user.Team.Description
                });
            }
            // --- 核心修改开始 ---
            // 3. 获取所有战队的统计信息 (ID, 当前人数, 是否已有队长)
            // 使用 Select 投影查询，比把所有 Member 拉出来效率更高
            var teamsStats = _context.Teams
                .Select(t => new
                {
                    Team = t,
                    MemberCount = t.Members.Count(),
                    HasCaptain = t.Members.Any(m => m.IsCaptain) // 检查该队是否已有成员是队长
                })
                .ToList();

            List<dynamic> candidateTeams;
            // 4. 根据用户身份筛选候选池
            if (user.IsCaptain)
            {
                // 逻辑：如果我是预制队长，我只能去“没有队长”的队伍
                candidateTeams = teamsStats
                    .Where(t => !t.HasCaptain)
                    .ToList<dynamic>();

                if (!candidateTeams.Any())
                {
                    return BadRequest("所有战队均已有指挥官，分配失败！请联系管理员。");
                }
            }
            else
            {
                // 逻辑：如果我是普通兵，所有队伍都可以去
                candidateTeams = teamsStats.ToList<dynamic>();
            }

            // 5. 人数平衡策略：找出人数最少的那一批战队
            // 例如：A队5人, B队5人, C队8人 -> 候选池为 A和B
            int minCount = candidateTeams.Min(t => t.MemberCount);

            // 允许一个小的浮动范围(比如0)，严格保持平衡
            var bestCandidates = candidateTeams
                .Where(t => t.MemberCount == minCount)
                .ToList();

            // 6. 从最优解中随机选一个 (避免总是按照数据库ID顺序分配)
            var random = new Random();
            var selected = bestCandidates[random.Next(bestCandidates.Count)].Team;

            // --- 核心修改结束 ---

            // 7. 执行分配
            user.Team = selected;
            user.TeamId = selected.Id;
            _context.SaveChanges();

            return Ok(new
            {
                teamId = selected.Id,
                teamName = selected.Name,
                teamDesc = selected.Description
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
                    isCaptain = user.IsCaptain
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
                .Where(c => c.TeamId == user.TeamId && !c.IsPlayed)
                .OrderBy(c => c.Rank) // 或者是按点数排序
                .ToList();

            return Ok(cards);
        }

        // [新增] 获取我的道具
        [HttpGet("my-items")]
        [Authorize]
        public IActionResult GetMyItems()
        {
            var user = GetCurrentUser();
            var items = _context.ItemCards.Where(i => i.UserId == user.Id && !i.IsUsed).ToList();
            return Ok(items);
        }
        // 抽卡接口 (混合池 + 碎片逻辑)
        [HttpPost("draw")]
        [Authorize]
        public IActionResult DrawCard([FromBody] DrawRequest request)
        {
            var user = GetCurrentUser();
            if (user.TeamId == null) return BadRequest("无战队");
            int teamId = user.TeamId.Value;
            //开启事务
            using var transaction = _context.Database.BeginTransaction();
            try
            {
                // 单人单点限抽一次
                // 检查 Cards 表：是否有该用户在该站点获取的牌（包括已打出的）
                bool hasCard = _context.Cards.Any(c =>
                    c.UserId == user.Id &&
                    c.OriginLocationId == request.LocationId);
                // 检查 ItemCards 表：是否有该用户在该站点获取的道具（包括已使用的）
                bool hasItem = _context.ItemCards.Any(i =>
                    i.UserId == user.Id &&
                    i.OriginLocationId == request.LocationId);
                if (hasCard || hasItem)
                {
                    //暂时注释用于测试
                    //return BadRequest("您已在此站点探索过，请前往下一个坐标！");
                }
                // --- 核心抽卡逻辑 ---
                // --- 1. 计算剩余库存 ---
                int availableCards = _context.Cards.Count(c => c.TeamId == null && !c.IsPlayed);
                int availableItems = _context.ItemCards.Count(i => i.UserId == null && !i.IsUsed);
                if (availableCards == 0 && availableItems == 0)
                {
                    return BadRequest("本区域及全城的资源已被搜刮殆尽！");
                }
                // --- 2. 概率判定 (drawStandard) ---
                var random = new Random();
                // 设为 50% (因为 80张牌 vs 83张道具，接近 1:1)
                bool tryDrawCard = random.Next(100) < 50;
                // --- 3. 智能回退逻辑 ---
                bool finalDrawCard = false;
                if (tryDrawCard)
                {
                    // 如果想抽卡，且有卡 -> 抽卡
                    // 如果想抽卡，但没卡了 -> 只能抽道具
                    finalDrawCard = (availableCards > 0);
                }
                else
                {
                    // 如果想抽道具，且有道具 -> 抽道具
                    // 如果想抽道具，但没道具了 -> 只能抽卡
                    if (availableItems > 0)
                    {
                        finalDrawCard = false;
                    }
                    else
                    {
                        finalDrawCard = true; // 道具没了，强制抽卡
                    }
                }

                // --- 4. 执行抽取 ---
                object resultData = null;
                string msg = "";
                if (finalDrawCard)
                {
                    var card = AssignStandardCardToTeam(teamId, user.Id, request.LocationId);
                    resultData = new { type = "card", data = card };
                    msg = "获得线索卡！";
                }
                else
                {
                    // 抽道具牌
                    var item = _context.ItemCards
                        .Where(i => i.UserId == null && !i.IsUsed)
                        .OrderBy(x => Guid.NewGuid())
                        .FirstOrDefault();

                    if (item == null) return BadRequest("所有资源已被搜刮殆尽！");
                    item.OriginLocationId = request.LocationId;
                    item.UserId = user.Id;
                    item.TeamId = teamId;
                    item.IsUsed = false;   // 默认未消耗，先落库
                    _context.SaveChanges();

                    // **特殊逻辑：碎片牌自动结算**
                    if (item.Type == ItemType.Fragment)
                    {
                        var teamFragments = _context.ItemCards
                            .Where(i => i.Type == ItemType.Fragment
                                     && !i.IsUsed
                                     && i.UserId.HasValue
                                     && i.TeamId == teamId)
                            .OrderBy(i => i.Id) // 按获取顺序或ID排序
                            .ToList();

                        string extraMsg = "";
                        // 每3张触发一次奖励
                        if (teamFragments.Count >= 3)
                        {
                            // 3.1 消耗前 3 张碎片
                            var fragmentsToConsume = teamFragments.Take(3).ToList();
                            foreach (var f in fragmentsToConsume)
                            {
                                f.IsUsed = true; // 标记为已使用
                            }
                            // 3.2 发放一张额外的线索卡
                            var bonusCard = AssignStandardCardToTeam(teamId, user.Id, null);
                            if (bonusCard != null)
                            {
                                extraMsg = " (队伍集齐3张碎片，自动兑换一张线索卡！)";
                                resultData = new { type = "fragment_bonus", item = item, card = bonusCard };
                            }
                            else
                            {
                                // 牌库空了的边缘情况
                                extraMsg = " (碎片已集齐，但卡池已空...)";
                                resultData = new { type = "item", data = item };
                            }
                        }
                        else
                        {
                            // 未凑齐
                            resultData = new { type = "item", data = item };
                            extraMsg = $" (当前队伍碎片进度: {teamFragments.Count}/3)";
                        }
                        msg = $"获得碎片牌！{extraMsg}";
                    }
                    else
                    {
                        resultData = new { type = "item", data = item };
                        msg = $"获得 {item.Name}！";
                    }
                }
                _context.SaveChanges();
                transaction.Commit();

                return Ok(new { message = msg, result = resultData });
            }
            catch (Exception ex)
            {
                transaction.Rollback();
                return StatusCode(500, ex.Message);
            }
        }

        // 使用通配牌
        [HttpPost("use-wild")]
        [Authorize]
        public IActionResult UseWildCard([FromBody] WildCardRequest req)
        {
            var user = GetCurrentUser();
            var item = _context.ItemCards.FirstOrDefault(i => i.Id == req.ItemId && i.UserId == user.Id && !i.IsUsed);
            if (item == null || item.Type != ItemType.Wild) return BadRequest("无效道具");

            // 变身逻辑：直接生成一张新牌给战队
            var newCard = new Card
            {
                Suit = req.Suit,
                Rank = req.Rank,
                Display = req.Suit + req.Rank,
                TeamId = user.TeamId,
                UserId = user.Id,
                IsPlayed = false,
                IsWildGenerated = true
            };
            _context.Cards.Add(newCard);

            item.IsUsed = true;
            _context.SaveChanges();
            return Ok(new { message = "通配牌使用成功，已生成线索卡！", card = newCard });
        }

        // [新增] 使用调换牌
        [HttpPost("use-swap")]
        [Authorize]
        public IActionResult UseSwapCard([FromBody] SwapCardRequest req)
        {
            var user = GetCurrentUser();
            var item = _context.ItemCards.FirstOrDefault(i => i.Id == req.ItemId && i.UserId == user.Id && !i.IsUsed);
            if (item == null || item.Type != ItemType.Swap) return BadRequest("无效道具");

            using var trans = _context.Database.BeginTransaction();
            try
            {
                // 1. 获取我方指定牌
                var myCard = _context.Cards.FirstOrDefault(c => c.Id == req.MyCardId && c.TeamId == user.TeamId && !c.IsPlayed);
                if (myCard == null) return BadRequest("我方卡牌不存在或已打出");

                // 2. 随机获取对方一张牌
                var targetCard = _context.Cards
                    .Where(c => c.TeamId == req.TargetTeamId && !c.IsPlayed)
                    .OrderBy(c => Guid.NewGuid())
                    .FirstOrDefault();

                if (targetCard == null) return BadRequest("对方战队已无手牌，无法调换！");

                // 3. 交换 TeamId
                int? tempTeam = myCard.TeamId;
                myCard.TeamId = targetCard.TeamId;
                targetCard.TeamId = tempTeam;

                item.IsUsed = true;
                _context.SaveChanges();
                trans.Commit();

                return Ok(new { message = $"调换成功！失去了 {myCard.Display}，夺取了 {targetCard.Display}" });
            }
            catch
            {
                trans.Rollback();
                throw;
            }
        }

        // 辅助：从牌库发一张牌给战队
        private Card AssignStandardCardToTeam(int teamId, int userId,int? locationId)
        {
            var card = _context.Cards
                .Where(c => c.TeamId == null && !c.IsPlayed)
                .OrderBy(c => Guid.NewGuid())
                .FirstOrDefault();

            if (card != null)
            {
                card.TeamId = teamId;
                card.UserId = userId;
                card.OriginLocationId = locationId;
                _context.SaveChanges();
            }
            return card;
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

        // [新增] 获取牌桌信息
        [HttpGet("table-state")]
        public IActionResult GetTableState()
        {
            // 直接查库，取 Id=1 的记录
            var state = _context.TableStates.FirstOrDefault(t => t.Id == 1);
            // 计算各队剩余手牌数 (未打出的牌)
            var teamCounts = _context.Teams
                .Select(t => new
                {
                    id = t.Id,
                    name = t.Name,
                    count = t.Cards.Count(c => !c.IsPlayed)
                })
                .OrderByDescending(t => t.count) // 按剩余牌数降序排列
                .ToList();
            if (state == null) return Ok(new { }); // 防御性代码

            return Ok(new
            {
                lastTeamId = state.LastTeamId,
                lastTeamName = state.LastTeamName,
                // 反序列化 JSON 给前端
                lastCards = string.IsNullOrEmpty(state.LastCardsJson)
                    ? new List<object>()
                    : JsonSerializer.Deserialize<List<object>>(state.LastCardsJson),
                // [新增] 返回队伍统计
                teamCounts = teamCounts
            });
        }

        [HttpPost("play-cards")]
        [Authorize]
        public IActionResult PlayCards([FromBody] PlayCardRequest request)
        {
            var user = GetCurrentUser();
            if (user.TeamId == null) return BadRequest("无战队");

            // 1. 查库获取当前牌桌状态
            var tableState = _context.TableStates.FirstOrDefault(t => t.Id == 1);
            if (tableState == null) return StatusCode(500, "牌桌未初始化");

            // 2. 查牌 & 校验 (保持不变)
            var dbCards = _context.Cards.Where(c => request.CardIds.Contains(c.Id)).ToList();
            if (dbCards.Count != request.CardIds.Count) return BadRequest("牌数据异常");
            if (dbCards.Any(c => c.TeamId != user.TeamId)) return BadRequest("你没有这些牌");
            if (dbCards.Any(c => c.IsPlayed)) return BadRequest("手慢了，牌已被打出");

            // 3. 分析牌型 (保持不变)
            var newHand = GuandanLogic.AnalyzeHand(dbCards);
            if (newHand.Type == HandType.None) return BadRequest("不合法的牌型");

            // 4. 比大小逻辑 (使用 database 中的 state)
            // 构造旧牌型对象用于比较
            var lastHandInfo = new HandInfo
            {
                Type = (HandType)tableState.LastHandType,
                Value = tableState.LastHandValue,
                Count = tableState.LastHandCount,
                Level = tableState.LastHandLevel
            };

            // 判定逻辑
            if (tableState.LastTeamId == 0) { /* 开局, Pass */ }
            else if (tableState.LastTeamId == user.TeamId)
            {
                return BadRequest("当前已经是你方占据战场！");
            }
            else
            {
                if (!GuandanLogic.CanBeat(newHand, lastHandInfo))
                {
                    return BadRequest("你的牌不够大！");
                }
            }

            // 5. 执行出牌
            foreach (var c in dbCards) c.IsPlayed = true;

            // ✅ 更新数据库中的牌桌状态
            tableState.LastTeamId = user.TeamId.Value;
            tableState.LastTeamName = user.Team.Name;

            tableState.LastHandType = (int)newHand.Type;
            tableState.LastHandValue = newHand.Value;
            tableState.LastHandCount = newHand.Count;
            tableState.LastHandLevel = newHand.Level;

            // 序列化卡牌视觉信息存入 JSON (只需存 UI 需要的字段)
            var visualCards = dbCards.Select(c => new {
                suit = c.Suit,
                rank = c.Rank,
                isWildGenerated = c.IsWildGenerated
            }).ToList();
            tableState.LastCardsJson = JsonSerializer.Serialize(visualCards);

            _context.SaveChanges(); // 一次性保存

            return Ok(new { message = "出牌成功！你方已占领战场！" });
        }


        // 获取当前用户
        private User GetCurrentUser()
        {
            var idClaim = User.Claims.FirstOrDefault(c => c.Type == "id");
            if (idClaim == null) return null;
            return _context.Users.Include(u => u.Team).FirstOrDefault(u => u.Id == int.Parse(idClaim.Value));
        }

        // 管理员相关接口 ---

        // 1. 获取管理员看板数据 (所有队伍 + 成员 + 队长标识)
        [HttpGet("admin/dashboard")]
        [Authorize]
        public IActionResult GetAdminDashboard()
        {
            // 这里简单判断一下权限，实际建议走 Role Claims
            // var username = User.Identity.Name;
            // if (username != "admin") return Unauthorized();

            var teams = _context.Teams
                .Include(t => t.Members)
                .Select(t => new
                {
                    t.Id,
                    t.Name,
                    t.Description,
            // 计算该队当前未使用的手牌数
            cardCount = t.Cards.Count(c => !c.IsPlayed),
                    members = t.Members.Select(m => new
                    {
                        m.Id,
                        m.RealName,
                        m.Username,
                        m.IsCaptain,
                // 是否在线/活跃 (5分钟内)
                isOnline = m.LastActiveTime > DateTime.UtcNow.AddMinutes(-5)
                    }).ToList()
                })
                .ToList();

            return Ok(teams);
        }

        // 2. 设置队长
        [HttpPost("admin/set-captain")]
        public IActionResult SetCaptain([FromBody] int userId)
        {
            var user = _context.Users.Find(userId);
            if (user == null) return NotFound("用户不存在");
            if (user.TeamId == null) return BadRequest("该用户没有战队");

            // 1. 找到该战队当前的队长，取消其资格
            var oldCaptains = _context.Users
                .Where(u => u.TeamId == user.TeamId && u.IsCaptain)
                .ToList();

            foreach (var old in oldCaptains)
            {
                old.IsCaptain = false;
            }

            // 2. 设置新队长
            user.IsCaptain = true;
            _context.SaveChanges();

            return Ok(new { message = $"已任命 {user.RealName} 为队长" });
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
    public class PlayCardRequest
    {
        public List<int> CardIds { get; set; }
    }
    public class WildCardRequest { public int ItemId { get; set; } public string Suit { get; set; } public string Rank { get; set; } }
    public class SwapCardRequest { public int ItemId { get; set; } public int MyCardId { get; set; } public int TargetTeamId { get; set; } }


}