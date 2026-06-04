using System.ComponentModel.DataAnnotations;
using Warden.Core.Extension;

namespace Warden.Application.Validators;

public class HttpUrlAttribute : ValidationAttribute
{
    public override bool IsValid(object? value)
    {
        if (value is string url)
        {
            return url.IsHttpUrl();
        }
        return false;
    }
}