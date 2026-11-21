using System.Text.RegularExpressions;

namespace Unmess.Deployer.Releases;

public static partial class ReleaseName
{
    [GeneratedRegex("^release(?<number>[0-9]{2,})$", RegexOptions.CultureInvariant)]
    private static partial Regex Pattern();

    public static bool IsValid(string? name) => name is not null && Pattern().IsMatch(name);

    public static int NumberOf(string name)
    {
        var match = Pattern().Match(name);
        if (!match.Success)
        {
            throw new ArgumentException($"Invalid release name: {name}", nameof(name));
        }

        return int.Parse(match.Groups["number"].Value, System.Globalization.CultureInfo.InvariantCulture);
    }
}
