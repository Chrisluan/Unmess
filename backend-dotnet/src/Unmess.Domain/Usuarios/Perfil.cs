namespace Unmess.Domain.Usuarios;

public enum Perfil
{
    Usuario,
    Admin,
    Super
}

public static class PerfilConversor
{
    public const string Admin = "admin";
    public const string Super = "super";
    public const string Usuario = "user";

    public static Perfil DoTexto(string? valor) => valor?.ToLowerInvariant() switch
    {
        Admin => Perfil.Admin,
        Super => Perfil.Super,
        _ => Perfil.Usuario
    };

    public static string ParaTexto(Perfil perfil) => perfil switch
    {
        Perfil.Admin => Admin,
        Perfil.Super => Super,
        _ => Usuario
    };

    public static bool TemAcessoTotal(string? perfil) => perfil is Admin or Super;
}
