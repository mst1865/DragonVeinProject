using Microsoft.EntityFrameworkCore;
using DragonVein.API.Models;
using System.Collections.Generic;

namespace DragonVein.API.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Team> Teams { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // 配置实体关系
            modelBuilder.Entity<User>()
                .HasOne(u => u.Team)
                .WithMany(t => t.Members)
                .HasForeignKey(u => u.TeamId)
                .IsRequired(false); // 允许 TeamId 为空

            // 1. 预制战队数据 (根据您的需求文档)
            modelBuilder.Entity<Team>().HasData(
                new Team { Id = 1, Name = "北镇抚司", EnName = "The North Division", Description = "架构/运维组 (Root权限)" },
                new Team { Id = 2, Name = "神机营", EnName = "Shenji Battalion", Description = "前端/移动端组 (火力输出)" },
                new Team { Id = 3, Name = "六扇门", EnName = "The Six Doors", Description = "全栈/测试组 (机动解决Bug)" },
                new Team { Id = 4, Name = "军统局", EnName = "Juntong Bureau", Description = "后端开发组 (数据逻辑)" },
                new Team { Id = 5, Name = "中央研究院", EnName = "Academia Sinica", Description = "算法/数据组 (智囊团)" }
            );

            // 2. 预制用户数据 (40人，初始未分配战队)
            var users = new List<User>();
            for (int i = 1; i <= 40; i++)
            {
                users.Add(new User
                {
                    Id = i,
                    Username = $"agent{i:000}", // 登录账号: agent001 ~ agent040
                    RealName = $"特工{i:000}",
                    TeamId = null // 关键：初始未分配，由首次登录逻辑分配
                });
            }
            modelBuilder.Entity<User>().HasData(users);
        }
    }
}