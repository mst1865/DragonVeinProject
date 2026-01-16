# 阶段 1: 构建
FROM mcr.microsoft.com/dotnet/core/sdk:3.1 AS build
WORKDIR /app

# 复制 csproj 并还原依赖
COPY ./DragonVein.API/*.csproj ./DragonVein.API/
WORKDIR /app/DragonVein.API
RUN dotnet restore

# 复制其余代码并发布
WORKDIR /app
COPY ./DragonVein.API/. ./DragonVein.API/
WORKDIR /app/DragonVein.API
RUN dotnet publish -c Release -o /app/out

# 阶段 2: 运行
FROM mcr.microsoft.com/dotnet/core/aspnet:3.1 AS runtime
WORKDIR /app
COPY --from=build /app/out .

# 暴露端口 80
EXPOSE 80
ENTRYPOINT ["dotnet", "DragonVein.API.dll"]