FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build_api_deps
WORKDIR /src
COPY warden-api/warden-api/warden-api.csproj .
RUN dotnet restore "warden-api.csproj"

FROM build_api_deps AS build_api
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY warden-api/warden-api .
RUN dotnet build "warden-api.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build_api AS publish_api
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "warden-api.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM node:22 AS build_ui_deps
WORKDIR /app
COPY warden-ui/package.json .
COPY warden-ui/package-lock.json .
RUN npm ci

FROM build_ui_deps AS build_ui
WORKDIR /app
COPY warden-ui .
RUN npm run build --prod

FROM base AS final
WORKDIR /app
COPY --from=publish_api /app/publish .
COPY --from=build_ui /app/dist/warden/browser wwwroot
ENTRYPOINT ["dotnet", "warden-api.dll"]
