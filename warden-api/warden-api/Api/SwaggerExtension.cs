using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.OpenApi;

namespace Warden.Api;

public static class SwaggerExtension
{
    public static IServiceCollection AddSwaggers(this IServiceCollection builder)
    {
        builder.AddEndpointsApiExplorer();
        builder.AddSwaggerGen(config =>
        {
            //config.SwaggerDoc("v1", new OpenApiInfo { Title = "API", Version = "v1" });
            config.CustomOperationIds(e => e.ActionDescriptor.RouteValues["action"]);
            config.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                In = ParameterLocation.Header,
                Description = "Please enter token",
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                BearerFormat = "JWT",
                Scheme = "bearer"
            });
            config.AddSecurityRequirement(doc => new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecuritySchemeReference("Bearer", doc),
                    []
                }
            });
            config.DocInclusionPredicate((docName, apiDesc) => true);
            config.TagActionsBy(api =>
            {
                if (api.GroupName != null)
                {
                    return [api.GroupName];
                }
                if (api.ActionDescriptor is ControllerActionDescriptor controllerActionDescriptor)
                {
                    return [controllerActionDescriptor.ControllerName];
                }
                throw new InvalidOperationException("Unable to determine tag for endpoint.");
            });
        });
        return builder;
    }
}