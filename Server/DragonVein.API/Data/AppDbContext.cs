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
                new Team { Id = 1, Name = "南镇抚司", EnName = "The South Division", Description = "锦衣卫南司 (法纪/军匠)" },
                new Team { Id = 2, Name = "神机营", EnName = "Shenji Battalion", Description = "明朝三大营 (火器部队)" },
                new Team { Id = 3, Name = "督察院", EnName = "The Censorate", Description = "明朝最高监察机构" },
                new Team { Id = 4, Name = "军统局", EnName = "Juntong Bureau", Description = "国民政府军事委员会调查统计局" },
                new Team { Id = 5, Name = "中华民族复兴社", EnName = "The Revival Society", Description = "蓝衣社 (精英组织)" }
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