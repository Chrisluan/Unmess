import React from "react";

import Typography from "@mui/material/Typography";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";

import Janela from "../../Janela";

/**
 * Pergunta o que fazer quando um card chega ao fim de um quadro.
 *
 * Antes o avanço era automático: soltar na coluna final mandava o trabalho para
 * o quadro seguinte sem ninguém confirmar, e o card sumia da tela. Mas nem todo
 * orçamento aprovado vira pedido, e nem toda etapa concluída deve abrir a
 * seguinte.
 *
 * Nos dois caminhos o card permanece visível na coluna final, marcado como
 * concluído. A escolha é só sobre nascer ou não um card adiante -- por isso
 * "Só concluir" é uma ação de verdade (à esquerda), e não o cancelar.
 */
const AvancarQuadroModal = ({ open, dealTitle, onClose, onConfirm }) => (
  <Janela
    open={open}
    onClose={onClose}
    icone={<FlagOutlinedIcon />}
    tom="sucesso"
    tamanho="xs"
    titulo="Concluir e gerar pedido?"
    subtitulo={
      <>
        {dealTitle ? <strong>{dealTitle}</strong> : "Este card"} chegou ao fim deste quadro.
      </>
    }
    acaoExtra={{ rotulo: "Só concluir", onClick: () => onConfirm(false) }}
    rotuloConfirmar="Gerar pedido"
    onConfirmar={() => onConfirm(true)}
  >
    <Typography variant="body2" color="text.secondary">
      Uma cópia será criada no próximo quadro, referenciando o número deste
      orçamento. De um jeito ou de outro, este card continua aqui, marcado como
      concluído.
    </Typography>
  </Janela>
);

export default AvancarQuadroModal;
