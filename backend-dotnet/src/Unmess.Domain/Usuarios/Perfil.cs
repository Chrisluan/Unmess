namespace Unmess.Domain.Usuarios;

public enum Perfil
{
    Usuario,
    Admin,
    Super
}

public static class PerfilConversor
{
    public static Perfil DoTexto(string? valor) => valor?.ToLowerInvariant() switch
    {
        "admin" => Perfil.Admin,
        "super" => Perfil.Super,
        _ => Perfil.Usuario
    };

    public static string ParaTexto(Perfil perfil) => perfil switch
    {
        Perfil.Admin => "admin",
        Perfil.Super => "super",
        _ => "user"
    };
}
