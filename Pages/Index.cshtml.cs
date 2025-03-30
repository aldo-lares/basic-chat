using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Configuration;

namespace GKChatInterface.Pages;

public class IndexModel : PageModel
{
    private readonly IConfiguration _configuration;

    public IndexModel(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public void OnGet()
    {
        ViewData["ChatApiUrl"] = _configuration["API:ChatEndpoint"];
        ViewData["AudioApiUrl"] = _configuration["API:AudioEndpoint"];
    }
}
