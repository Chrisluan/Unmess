namespace Unmess.Domain.Usuarios;

public enum Perfil
{
    Usuario,
    Admin
}

public static class PerfilConversor
{
    public static Perfil DoTexto(string? valor) =>
        string.Equals(valor, "admin", StringComparison.OrdinalIgnoreCase) ? Perfil.Admin : Perfil.Usuario;

    public static string ParaTexto(Perfil perfil) => perfil == Perfil.Admin ? "admin" : "user";
}
