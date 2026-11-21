namespace Unmess.Deployer.Releases;

public enum CommandStatus
{
    Accepted,
    Ignored,
    Deferred,
    NotFound,
    Conflict,
    Invalid
}

public sealed record CommandResult(CommandStatus Status, string? Error = null)
{
    public static CommandResult Accepted() => new(CommandStatus.Accepted);
    public static CommandResult Ignored(string reason) => new(CommandStatus.Ignored, reason);
    public static CommandResult Deferred(string reason) => new(CommandStatus.Deferred, reason);
    public static CommandResult NotFound(string error) => new(CommandStatus.NotFound, error);
    public static CommandResult Conflict(string error) => new(CommandStatus.Conflict, error);
    public static CommandResult Invalid(string error) => new(CommandStatus.Invalid, error);
}
