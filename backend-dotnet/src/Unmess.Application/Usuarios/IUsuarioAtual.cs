using Unmess.Domain.Usuarios;

namespace Unmess.Application.Usuarios;

public interface IUsuarioAtual
{
    UsuarioAutenticado? Obter();
}
