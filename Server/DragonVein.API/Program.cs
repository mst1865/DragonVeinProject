using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DragonVein.API.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace DragonVein.API
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var host = CreateHostBuilder(args).Build();

            // === 核心逻辑：启动时自动建表 ===
            using (var scope = host.Services.CreateScope())
            {
                var services = scope.ServiceProvider;
                try
                {
                    var context = services.GetRequiredService<AppDbContext>();

                    // 自动创建数据库和表（如果不存在）
                    // 注意：EnsureCreated() 不适用 Migrations。如果后续要用 Migrations，请改用 context.Database.Migrate();
                    context.Database.EnsureCreated();

                    Console.WriteLine("数据库初始化成功 (Snake Case 模式)");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"数据库初始化失败: {ex.Message}");
                }
            }
            // ================================

            host.Run();
        }

        public static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args)
                .ConfigureWebHostDefaults(webBuilder =>
                {
                    webBuilder.UseStartup<Startup>();
                });
    }
}
