using Microsoft.EntityFrameworkCore;
using DragonVein.API.Models;
using System.Collections.Generic;
using System.Linq;

namespace DragonVein.API.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Team> Teams { get; set; }
        public DbSet<Card> Cards { get; set; }
        public DbSet<Location> Locations { get; set; }
        public DbSet<ItemCard> ItemCards { get; set; }
        public DbSet<TableState> TableStates { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.HasPostgresExtension("uuid-ossp");
            base.OnModelCreating(modelBuilder);

            // 1. 战队预制 (保持不变)
            modelBuilder.Entity<Team>().HasData(
                new Team { Id = 1, Name = "南镇抚司", EnName = "The South Division", Description = "锦衣卫南司 (法纪/军匠)" },
                new Team { Id = 2, Name = "神机营", EnName = "Shenji Battalion", Description = "明朝三大营 (火器部队)" },
                new Team { Id = 3, Name = "督察院", EnName = "The Censorate", Description = "明朝最高监察机构" },
                new Team { Id = 4, Name = "军统局", EnName = "Juntong Bureau", Description = "国民政府军事委员会调查统计局" },
                new Team { Id = 5, Name = "中华民族复兴社", EnName = "The Revival Society", Description = "蓝衣社 (精英组织)" }
            );

            

            // 3. 扑克牌预制：2副牌 (A-K，共104张)，无大小王
            // 分配规则：Site 1-4 各21张，Site 5 20张。
            var cards = GenerateDeckOfCards(2); // 生成两副牌

            // 为了种子数据的确定性，我们按顺序分配给站点，实际抽取时是随机的
            // 站点配置
            int[] distribution = new int[] { 21, 21, 21, 21, 20 };

            int cardIndex = 0;
            int cardIdCounter = 1;

            // 遍历5个站点分配卡牌
            for (int locId = 1; locId <= 5; locId++)
            {
                int count = distribution[locId - 1];
                for (int c = 0; c < count; c++)
                {
                    if (cardIndex < cards.Count)
                    {
                        var card = cards[cardIndex];
                        card.Id = cardIdCounter++;
                        cardIndex++;
                    }
                }
            }
            modelBuilder.Entity<Card>().HasData(cards);
        }

        private List<Card> GenerateDeckOfCards(int decks)
        {
            var suits = new[] { "♠", "♥", "♣", "♦" };
            var ranks = new[] { "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K" };
            var list = new List<Card>();

            for (int d = 0; d < decks; d++)
            {
                foreach (var s in suits)
                {
                    for (int i = 0; i < ranks.Length; i++)
                    {
                        list.Add(new Card
                        {
                            Suit = s,
                            Rank = ranks[i],
                            TeamId = null
                        });
                    }
                }
            }
            return list;
        }
    }
}