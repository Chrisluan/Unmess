namespace Upu.Core.Validacao;

/// <summary>
/// Um campo que falta ou está errado, com o motivo em português.
///
/// O painel usa `Campo` para acender a borda vermelha no lugar certo, e
/// `Mensagem` para dizer por que aquilo importa — em vez de um "campo
/// obrigatório" que não ensina nada.
/// </summary>
/// <param name="Campo">Nome do campo, igual ao do JSON (`resumoParaUsuarios`).</param>
/// <param name="Mensagem">O que está faltando, e por quê.</param>
public sealed record ErroDeCampo(string Campo, string Mensagem);
