import React from "react";

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";

/**
 * Pergunta o que fazer quando um card chega ao fim de um quadro.
 *
 * Antes o avanço era automático: soltar na coluna final mandava o trabalho para
 * o quadro seguinte sem ninguém confirmar, e o card sumia da tela. Mas nem todo
 * orçamento aprovado vira pedido, e nem toda etapa concluída deve abrir a
 * seguinte.
 *
 * Nos dois caminhos o card permanece visível na coluna final, marcado como
 * concluído. A escolha é só sobre nascer ou não um card adiante.
 */
const AvancarQuadroModal = ({ open, dealTitle, onClose, onConfirm }) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>Concluir e gerar pedido?</DialogTitle>

    <DialogContent>
      <DialogContentText component="div">
        <p style={{ marginTop: 0 }}>
          {dealTitle ? <strong>{dealTitle}</strong> : "Este card"} chegou ao fim
          deste quadro.
        </p>
        <p style={{ marginBottom: 0 }}>
          Deseja abrir o pedido no próximo quadro? Uma cópia será criada lá,
          referenciando o número deste orçamento. De um jeito ou de outro, este
          card continua aqui, marcado como concluído.
        </p>
      </DialogContentText>
    </DialogContent>

    <DialogActions>
      <Button onClick={onClose} color="inherit">
        Cancelar
      </Button>
      {/* Concluir sem gerar é uma escolha legítima, não um cancelamento --
          por isso os dois botões de ação, e o cancelar separado. */}
      <Button onClick={() => onConfirm(false)}>Só concluir</Button>
      <Button onClick={() => onConfirm(true)} variant="contained">
        Gerar pedido
      </Button>
    </DialogActions>
  </Dialog>
);

export default AvancarQuadroModal;
