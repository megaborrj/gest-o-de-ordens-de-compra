import { GoogleGenAI, Type } from "@google/genai";
import type { ExtractedPurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '../types';

// Initialize and export the shared GoogleGenAI client instance
export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// Helper to convert File to a Gemini-compatible format
const fileToGenerativePart = async (file: File) => {
  const base64EncodedData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return {
    inlineData: {
      data: base64EncodedData,
      mimeType: file.type,
    },
  };
};

const purchaseOrderSchema = {
  type: Type.OBJECT,
  properties: {
    fornecedor: { type: Type.STRING, description: "Nome do fornecedor." },
    cnpj: { type: Type.STRING, description: "CNPJ do fornecedor.", nullable: true },
    notaFiscal: { type: Type.STRING, description: "Número da nota fiscal, se houver.", nullable: true },
    operacao: { type: Type.STRING, description: "Tipo de operação (e.g., 'Compra para Revenda')." },
    filial: { type: Type.STRING, description: "Filial de destino da compra." },
    pedido: { type: Type.STRING, description: "Número do pedido de compra." },
    sequencia: { type: Type.STRING, description: "Número da sequência ou outro identificador principal." },
    data: { type: Type.STRING, description: "Data do documento no formato DD/MM/AAAA." },
    emissao: { type: Type.STRING, description: "Data de emissão do documento no formato DD/MM/AAAA.", nullable: true },
    recebimento: { type: Type.STRING, description: "Data de recebimento prevista no formato DD/MM/AAAA.", nullable: true },
    observacoes: { type: Type.STRING, description: "Este campo corresponde ao 'link do pedido'. Extraia qualquer URL ou link encontrado no documento.", nullable: true },
    linkEntrada: { type: Type.STRING, description: "Link de entrada para o pedido, se houver.", nullable: true },
    totalGeral: { type: Type.NUMBER, description: "Valor total do pedido." },
    items: {
      type: Type.ARRAY,
      description: "Lista de itens do pedido.",
      items: {
        type: Type.OBJECT,
        properties: {
          codigo: { type: Type.STRING, description: "Código do produto do fornecedor." },
          descricao: { type: Type.STRING, description: "Descrição do produto." },
          unidade: { type: Type.STRING, description: "Unidade de medida (e.g., 'UN', 'PC', 'KG')." },
          quantidade: { type: Type.NUMBER, description: "Quantidade do item." },
          precoUnitario: { type: Type.NUMBER, description: "Preço por unidade do item." },
          precoTotal: { type: Type.NUMBER, description: "Preço total para o item (quantidade * preço unitário)." },
        },
        required: ["codigo", "descricao", "unidade", "quantidade", "precoUnitario", "precoTotal"],
      },
    },
    isBook: { type: Type.BOOLEAN, description: "A compra é para a categoria 'Book'?" },
    isSite: { type: Type.BOOLEAN, description: "A compra é para a categoria 'Site'?" },
    isRevisaoImpostos: { type: Type.BOOLEAN, description: "A compra precisa de revisão de impostos?" },
    isCasado: { type: Type.BOOLEAN, description: "É um pedido 'Casado'?" },
    isEstoque: { type: Type.BOOLEAN, description: "A compra é para 'Estoque'?" },
    isRemarcar: { type: Type.BOOLEAN, description: "Os itens precisam ser remarcados?" },
  },
  required: ["fornecedor", "operacao", "filial", "pedido", "sequencia", "data", "totalGeral", "items"],
};

const extractionPrompt = `
  Analise a imagem ou texto fornecido, que é uma ordem de compra. Extraia as seguintes informações e retorne-as em formato JSON, seguindo estritamente o schema fornecido.
  - Se um campo não for encontrado, retorne uma string vazia "" para campos de texto, 0 para campos numéricos ou false para booleanos, a menos que o campo seja opcional (nullable).
  - A data deve estar no formato DD/MM/AAAA.
  - Calcule o precoTotal para cada item se não estiver explicitamente listado (quantidade * precoUnitario).
  - Some os totais dos itens para obter o totalGeral se não estiver explícito.
  - Para as classificações booleanas (isBook, isSite, etc.), infira com base no contexto do pedido. Se não houver contexto, defina como false.
  - No campo 'observacoes', que é o "link do pedido", se houver um link para uma nota fiscal eletrônica (NFe), extraia APENAS o link.
  - IMPORTANTE: O valor para o campo 'operacao' pode estar rotulado como 'Previsão' no documento. Se o campo 'Operação' estiver vazio ou ausente, use o valor do campo 'Previsão' para preencher 'operacao'.
`;

const parseAndValidateJson = (jsonString: string): ExtractedPurchaseOrder => {
    try {
        const cleanedJsonString = jsonString.replace(/```json|```/g, '').trim();
        const data = JSON.parse(cleanedJsonString);
        
        const status: PurchaseOrderStatus = (data.notaFiscal && data.notaFiscal.trim() !== '') ? 'Recebido' : 'Iniciado';
        
        return {
            ...data,
            status: status,
            nomeReferencia: '',
            items: data.items || [],
            totalGeral: data.totalGeral || 0,
        };
    } catch (error) {
        console.error("Failed to parse JSON response from Gemini:", error);
        throw new Error("A IA retornou uma resposta em formato inválido. Por favor, tente novamente ou verifique os dados de entrada.");
    }
};

export const extractPurchaseOrderData = async (files: File[]): Promise<ExtractedPurchaseOrder> => {
    const imageParts = await Promise.all(files.map(fileToGenerativePart));
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ text: extractionPrompt }, ...imageParts] }],
        config: {
            responseMimeType: 'application/json',
            responseSchema: purchaseOrderSchema,
        },
    });

    const jsonString = response.text;
    if (!jsonString) {
      throw new Error("A IA não retornou nenhum dado. Verifique a imagem e tente novamente.");
    }

    return parseAndValidateJson(jsonString);
};

export const extractPurchaseOrderDataFromText = async (text: string): Promise<ExtractedPurchaseOrder> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ text: `${extractionPrompt}\n\nAqui está o texto para analisar:\n\n${text}` }] }],
        config: {
            responseMimeType: 'application/json',
            responseSchema: purchaseOrderSchema,
        },
    });

    const jsonString = response.text;
    if (!jsonString) {
      throw new Error("A IA não retornou nenhum dado. Verifique o texto e tente novamente.");
    }
    
    return parseAndValidateJson(jsonString);
};

export const generateOrderReferenceName = async (items: PurchaseOrderItem[]): Promise<string> => {
    if (!items || items.length === 0) return '';
    
    const itemsDescription = items.map(item => `- ${item.quantidade}x ${item.descricao}`).join('\n');
    
    const prompt = `
      Com base na lista de itens de uma ordem de compra abaixo, crie um nome de referência curto e descritivo (máximo 5 palavras) para identificar rapidamente o conteúdo do pedido.
      Exemplos: "Compra de Pneus Aro 15", "Material de Escritório Diversos", "Filtros e Óleo para Motor".
      NÃO inclua o prefixo "Nome de Referência:" na sua resposta. Retorne APENAS o nome.
      
      Itens:
      ${itemsDescription}
      
      Nome de Referência:
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });

    // Clean the response to ensure the prefix is not included, even if the model makes a mistake.
    const referenceName = response.text.trim().replace(/^nome de referência:\s*/i, '');
    return referenceName;
};

export const generateSummary = async (text: string): Promise<string> => {
  const prompt = `
    Você é um assistente especializado em extrair e formatar informações de pedidos de compra para resumos rápidos no WhatsApp. Sua tarefa é analisar o texto bruto de um pedido de compra e reformatá-lo em um resumo claro, conciso e padronizado, usando markdown com asteriscos para negrito e emojis.

    Siga ESTRITAMENTE o seguinte formato de saída, preenchendo as informações extraídas do texto:

    🧾 *ENTRADA DE MATERIAL*
    Filial: [Extrair o número da filial]
    🔢 *Sequência:* [Extrair o número da sequência]
    📄 *Nota Fiscal (NF):* [Extrair o número da nota fiscal]
    📅 *Emissão:* [Extrair a data de emissão no formato DD/MM/AAAA]
    ⚙ *Operação:* [Extrair o número da operação. O texto pode usar a palavra 'Previsão' para se referir à operação.]
    🤝 *Fornecedor:* [Extrair o nome do fornecedor]
    *CNPJ:* [Extrair o CNPJ do fornecedor]

    📋 *Produtos*
    - *[CÓDIGO] – [DESCRIÇÃO COMPLETA, incluindo a cor]* – *Qtde: [QUANTIDADE]* – *Unit.: [VALOR UNITÁRIO]* – *Total: [VALOR TOTAL]*
    (Repita para todos os produtos. A descrição completa deve juntar o que está nas colunas DESCRIÇÃO e COR.)

    🚚 *Transportadora:* [Extrair o nome da transportadora, se houver. Se não encontrar, deixe em branco.]
    💰 *Frete:* *[Extrair o valor do frete. Se não encontrar, coloque 0,00]*

    💳 *Pagamento em Carteira:*
    - *[VALOR PARCELA 1]* – Venc.: [VENCIMENTO 1]
    - *[VALOR PARCELA 2]* – Venc.: [VENCIMENTO 2]
    (Liste todas as parcelas de pagamento encontradas, com seus respectivos valores e vencimentos.)

    🔗 *Observação/Link:*
    [Visualizar Documento 1]([Extrair qualquer link/URL encontrado no texto])

    ---
    Texto para resumir:
    ---
    ${text}
    ---

    Resumo:
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  return response.text.trim();
};