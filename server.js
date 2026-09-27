const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

let ordens = [];

// Valida tipoProduto se for (1, 2 ou 3).
function tipoProdutoValido(tipo) {
  const tiposValidos = [1, 2, 3];
  const tipoNum = Number(tipo);
  for (let i = 0; i < tiposValidos.length; i++) {
    if (tiposValidos[i] === tipoNum) return true;
  }
  return false;
}

function calcularCustoAjustado(tipoProduto, custoUnitarioBase) {
  switch (Number(tipoProduto)) {
    case 1: // Padrão
      return custoUnitarioBase;
    case 2: // Premium 
      return custoUnitarioBase * 1.10;
    case 3: // Sob encomenda 
      return custoUnitarioBase * 1.20;
    default:
      return custoUnitarioBase;
  }
}

function calcularAlerta(estoqueFinal) {
  if (estoqueFinal > 5000) return 'ALTO';
  if (estoqueFinal < 500) return 'CRITICO';
  return 'NORMAL';
}

function recalcularOrdem(ordem) {
  ordem.estoqueFinal = ordem.estoqueInicial + ordem.quantidadeProduzida;
  ordem.custoUnitarioAjustado = calcularCustoAjustado(ordem.tipoProduto, ordem.custoUnitarioBase);
  ordem.custoTotal = ordem.quantidadeProduzida * ordem.custoUnitarioAjustado;
  ordem.alertaEstoque = calcularAlerta(ordem.estoqueFinal);
  return ordem;
}

// Endpoints das Ordens

// POST /ordens
app.post('/ordens', (req, res) => {
  const {
    codigoOrdem,
    codigoProduto,
    tipoProduto,
    quantidadeProduzida,
    custoUnitarioBase,
    estoqueInicial
  } = req.body;

  if (
    codigoOrdem === undefined ||
    codigoProduto === undefined ||
    tipoProduto === undefined ||
    quantidadeProduzida === undefined ||
    custoUnitarioBase === undefined ||
    estoqueInicial === undefined
  ) {
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });
  }


  const jaExiste = ordens.find((o) => o.codigoOrdem == codigoOrdem);
  if (jaExiste) {
    return res.status(400).json({ erro: `Já existe uma ordem com o código "${codigoOrdem}".` });
  }

  if (!tipoProdutoValido(tipoProduto)) {
    return res.status(400).json({ erro: 'tipoProduto inválido. Use 1 (Padrão), 2 (Premium) ou 3 (Sob encomenda).' });
  }

  let novaOrdem = {
    codigoOrdem,
    codigoProduto,
    tipoProduto: Number(tipoProduto),
    quantidadeProduzida: Number(quantidadeProduzida),
    custoUnitarioBase: Number(custoUnitarioBase),
    estoqueInicial: Number(estoqueInicial)
  };

  novaOrdem = recalcularOrdem(novaOrdem);
  ordens.push(novaOrdem);

  res.status(201).json(novaOrdem);
});

// GET /ordens 
app.get('/ordens', (req, res) => {
  let resultado = ordens;
  const { tipo, alerta } = req.query;

  if (tipo !== undefined) {
    resultado = resultado.filter((o) => o.tipoProduto === Number(tipo));
  }
  if (alerta !== undefined) {
    resultado = resultado.filter((o) => o.alertaEstoque === String(alerta).toUpperCase());
  }

  res.json(resultado);
});

// GET /ordens/:codigoOrdem 
app.get('/ordens/:codigoOrdem', (req, res) => {
  const ordem = ordens.find((o) => o.codigoOrdem == req.params.codigoOrdem);
  if (!ordem) {
    return res.status(404).json({ erro: 'Ordem não encontrada.' });
  }
  res.json(ordem);
});

// PUT /ordens/:codigoOrdem
app.put('/ordens/:codigoOrdem', (req, res) => {
  const ordem = ordens.find((o) => o.codigoOrdem == req.params.codigoOrdem);
  if (!ordem) {
    return res.status(404).json({ erro: 'Ordem não encontrada.' });
  }

  const {
    codigoProduto,
    tipoProduto,
    quantidadeProduzida,
    custoUnitarioBase,
    estoqueInicial
  } = req.body;

  if (tipoProduto !== undefined && !tipoProdutoValido(tipoProduto)) {
    return res.status(400).json({ erro: 'tipoProduto inválido. Use 1 (Padrão), 2 (Premium) ou 3 (Sob encomenda).' });
  }

  if (codigoProduto !== undefined) ordem.codigoProduto = codigoProduto;
  if (tipoProduto !== undefined) ordem.tipoProduto = Number(tipoProduto);
  if (quantidadeProduzida !== undefined) ordem.quantidadeProduzida = Number(quantidadeProduzida);
  if (custoUnitarioBase !== undefined) ordem.custoUnitarioBase = Number(custoUnitarioBase);
  if (estoqueInicial !== undefined) ordem.estoqueInicial = Number(estoqueInicial);

  recalcularOrdem(ordem);

  res.json(ordem);
});

// DELETE /ordens/:codigoOrdem 
app.delete('/ordens/:codigoOrdem', (req, res) => {
  const index = ordens.findIndex((o) => o.codigoOrdem == req.params.codigoOrdem);
  if (index === -1) {
    return res.status(404).json({ erro: 'Ordem não encontrada.' });
  }

  ordens.splice(index, 1);
  res.json({ mensagem: 'Ordem removida com sucesso.' });
});

// Endpoint dp Relatório

// GET /relatorios/ordens 
app.get('/relatorios/ordens', (req, res) => {
  const totalOrdens = ordens.length;

  const estoquePorTipo = { padrao: 0, premium: 0, sobEncomenda: 0 };
  const quantidadeAlertas = { alto: 0, critico: 0, normal: 0 };
  const porProduto = {};

  let somaCustoTotal = 0;
  let ordemMaisCara = null;
  let ordemMaisBarata = null;

  ordens.forEach((o) => {

    if (o.tipoProduto === 1) estoquePorTipo.padrao += o.estoqueFinal;
    else if (o.tipoProduto === 2) estoquePorTipo.premium += o.estoqueFinal;
    else if (o.tipoProduto === 3) estoquePorTipo.sobEncomenda += o.estoqueFinal;

    if (o.alertaEstoque === 'ALTO') quantidadeAlertas.alto++;
    else if (o.alertaEstoque === 'CRITICO') quantidadeAlertas.critico++;
    else quantidadeAlertas.normal++;

    somaCustoTotal += o.custoTotal;


    if (!ordemMaisCara || o.custoTotal > ordemMaisCara.custoTotal) {
      ordemMaisCara = { codigoOrdem: o.codigoOrdem, custoTotal: o.custoTotal };
    }
    if (!ordemMaisBarata || o.custoTotal < ordemMaisBarata.custoTotal) {
      ordemMaisBarata = { codigoOrdem: o.codigoOrdem, custoTotal: o.custoTotal };
    }


    if (!porProduto[o.codigoProduto]) {
      porProduto[o.codigoProduto] = {
        estoqueFinalConsolidado: 0,
        valorTotalInvestido: 0
      };
    }
    porProduto[o.codigoProduto].estoqueFinalConsolidado += o.estoqueFinal;
    porProduto[o.codigoProduto].valorTotalInvestido += o.custoTotal;
  });

  const mediaCustoTotalPorOrdem = totalOrdens > 0 ? somaCustoTotal / totalOrdens : 0;

  res.json({
    totalOrdens,
    estoquePorTipo,
    mediaCustoTotalPorOrdem,
    ordemMaisCara,
    ordemMaisBarata,
    quantidadeAlertas,
    porProduto
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});