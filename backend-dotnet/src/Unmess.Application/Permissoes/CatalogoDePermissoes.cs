namespace Unmess.Application.Permissoes;

public sealed record ModuloDePermissao(string Rotulo, IReadOnlyDictionary<string, string> Permissoes);

public static class CatalogoDePermissoes
{
    public static readonly IReadOnlyDictionary<string, ModuloDePermissao> Modulos = new Dictionary<string, ModuloDePermissao>
    {
        ["tickets"] = new("Conversas", new Dictionary<string, string>
        {
            ["tickets:access"] = "Acesso ao módulo",
            ["tickets:view"] = "Visualizar",
            ["tickets:create"] = "Criar",
            ["tickets:edit"] = "Editar",
            ["tickets:delete"] = "Excluir",
            ["tickets:transfer"] = "Transferir",
            ["tickets:export"] = "Exportar",
            ["tickets:viewAll"] = "Ver todas as conversas"
        }),
        ["contacts"] = new("Contatos", new Dictionary<string, string>
        {
            ["contacts:access"] = "Acesso ao módulo",
            ["contacts:view"] = "Visualizar",
            ["contacts:create"] = "Criar",
            ["contacts:edit"] = "Editar",
            ["contacts:delete"] = "Excluir",
            ["contacts:import"] = "Importar contatos"
        }),
        ["clients"] = new("Clientes", new Dictionary<string, string>
        {
            ["clients:access"] = "Acesso ao módulo",
            ["clients:view"] = "Visualizar",
            ["clients:create"] = "Criar",
            ["clients:edit"] = "Editar",
            ["clients:delete"] = "Excluir"
        }),
        ["crm"] = new("CRM (Quadros)", new Dictionary<string, string>
        {
            ["crm:access"] = "Acesso ao módulo",
            ["crm:view"] = "Visualizar quadros",
            ["crm:create"] = "Criar negócio",
            ["crm:edit"] = "Editar negócio",
            ["crm:move"] = "Mover negócio entre colunas",
            ["crm:delete"] = "Excluir negócio",
            ["crm:manageStages"] = "Configurar colunas do quadro",
            ["crm:manageBoards"] = "Criar e ordenar quadros",
            ["crm:viewAll"] = "Ver negócios de todos os responsáveis"
        }),
        ["tags"] = new("Etiquetas", new Dictionary<string, string>
        {
            ["tags:access"] = "Acesso ao módulo",
            ["tags:view"] = "Visualizar",
            ["tags:create"] = "Criar",
            ["tags:edit"] = "Editar",
            ["tags:delete"] = "Excluir",
            ["tags:assign"] = "Aplicar etiqueta em conversas"
        }),
        ["quickAnswers"] = new("Respostas Rápidas", new Dictionary<string, string>
        {
            ["quickAnswers:access"] = "Acesso ao módulo",
            ["quickAnswers:view"] = "Visualizar",
            ["quickAnswers:create"] = "Criar",
            ["quickAnswers:edit"] = "Editar",
            ["quickAnswers:delete"] = "Excluir"
        }),
        ["products"] = new("Produtos", new Dictionary<string, string>
        {
            ["products:access"] = "Acesso ao módulo",
            ["products:manage"] = "Cadastrar e editar produtos"
        }),
        ["stickers"] = new("Figurinhas", new Dictionary<string, string>
        {
            ["stickers:access"] = "Acesso ao módulo",
            ["stickers:view"] = "Visualizar",
            ["stickers:create"] = "Adicionar",
            ["stickers:delete"] = "Excluir",
            ["stickers:send"] = "Enviar em conversas"
        }),
        ["queues"] = new("Filas", new Dictionary<string, string>
        {
            ["queues:access"] = "Acesso ao módulo",
            ["queues:view"] = "Visualizar",
            ["queues:create"] = "Criar",
            ["queues:edit"] = "Editar",
            ["queues:delete"] = "Excluir"
        }),
        ["users"] = new("Usuários", new Dictionary<string, string>
        {
            ["users:access"] = "Acesso ao módulo",
            ["users:view"] = "Visualizar",
            ["users:create"] = "Criar",
            ["users:edit"] = "Editar",
            ["users:delete"] = "Excluir"
        }),
        ["connections"] = new("Conexões", new Dictionary<string, string>
        {
            ["connections:access"] = "Acesso ao módulo",
            ["connections:view"] = "Visualizar",
            ["connections:create"] = "Criar",
            ["connections:edit"] = "Editar",
            ["connections:delete"] = "Excluir"
        }),
        ["dashboard"] = new("Dashboard", new Dictionary<string, string>
        {
            ["dashboard:access"] = "Acesso ao módulo",
            ["dashboard:view"] = "Visualizar métricas"
        }),
        ["settings"] = new("Configurações", new Dictionary<string, string>
        {
            ["settings:access"] = "Acesso ao módulo",
            ["settings:view"] = "Visualizar",
            ["settings:edit"] = "Editar"
        }),
        ["permissionGroups"] = new("Grupos de Permissão", new Dictionary<string, string>
        {
            ["permissionGroups:access"] = "Acesso ao módulo",
            ["permissionGroups:view"] = "Visualizar",
            ["permissionGroups:create"] = "Criar",
            ["permissionGroups:edit"] = "Editar",
            ["permissionGroups:delete"] = "Excluir"
        })
    };

    public static readonly IReadOnlyList<string> Todas = Modulos.Values.SelectMany(modulo => modulo.Permissoes.Keys).ToList();

    private static readonly HashSet<string> Conjunto = [.. Todas];

    public static bool Existe(string permissao) => Conjunto.Contains(permissao);
}
