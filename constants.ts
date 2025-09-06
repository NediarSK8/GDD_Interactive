import { Document } from './types';

export const INITIAL_DOCUMENTS: Document[] = [
  {
    id: '1',
    title: 'Princípios de Design de Personagem',
    category: 'Arte',
    // FIX: Added missing lastEdited property.
    lastEdited: '2024-01-01T00:00:00.000Z',
    content: [
        { type: 'paragraph', text: `Nosso design de personagem segue uma abordagem de 'realismo estilizado'. As características principais incluem silhuetas exageradas e rostos expressivos. Todos os personagens devem se encaixar na estética definida no [[Guia de Estilo Visual]]. O protagonista principal, Kael, é projetado para ser ágil e misterioso.` }
    ]
  },
  {
    id: '2',
    title: 'Guia de Estilo Visual',
    category: 'Arte',
    // FIX: Added missing lastEdited property.
    lastEdited: '2024-01-01T00:00:00.000Z',
    content: [
        { type: 'paragraph', text: `O estilo visual do jogo é uma fusão de cyberpunk e mitologia antiga. Usamos uma paleta de cores de alto contraste com detalhes em neon contra ambientes escuros e chuvosos. A inspiração é tirada de filmes clássicos neo-noir. Todos os assets devem seguir estas diretrizes.` }
    ]
  },
  {
    id: '3',
    title: 'Loop Principal de Gameplay',
    category: 'Gameplay',
    // FIX: Added missing lastEdited property.
    lastEdited: '2024-01-01T00:00:00.000Z',
    content: [
        { type: 'paragraph', text: `O loop principal é: EXPLORAR, LUTAR, MELHORAR. Os jogadores exploram o mundo para encontrar recursos e missões. Eles se envolvem em nossas [[Mecânicas de Combate]] para superar desafios. Finalmente, eles usam recompensas para melhorar seus equipamentos e habilidades.` }
    ]
  },
  {
    id: '4',
    title: 'Mecânicas de Combate',
    category: 'Gameplay',
    // FIX: Added missing lastEdited property.
    lastEdited: '2024-01-01T00:00:00.000Z',
    content: [
        { type: 'paragraph', text: `O combate é um sistema de terceira pessoa em ritmo acelerado, focado em esquivar e contra-atacar. Os jogadores têm um ataque leve, um ataque pesado e habilidades especiais ligadas aos [[Amuletos]] equipados. O gerenciamento de estamina é crucial.` }
    ]
  },
  {
    id: '5',
    title: 'Música Tema Principal',
    category: 'Som',
    // FIX: Added missing lastEdited property.
    lastEdited: '2024-01-01T00:00:00.000Z',
    content: [
        { type: 'paragraph', text: `O tema principal é uma peça orquestral com toques eletrônicos, refletindo o cenário do jogo. Deve ser memorável e evoluir durante momentos chave da história, conforme descrito no [[Arco da História Principal]].` }
    ]
  },
  {
    id: '6',
    title: 'Arco da História Principal',
    category: 'História',
    // FIX: Added missing lastEdited property.
    lastEdited: '2024-01-01T00:00:00.000Z',
    content: [
        { type: 'paragraph', text: `A história segue Kael, um pária que descobre ser a chave para impedir uma profecia de fim do mundo. O arco é dividido em três atos: O Despertar, A Descida e O Acerto de Contas. A jornada de Kael é de autodescoberta e sacrifício.` }
    ]
  },
  {
    id: '7',
    title: 'Amuletos',
    category: 'Lógica',
    // FIX: Added missing lastEdited property.
    lastEdited: '2024-01-01T00:00:00.000Z',
    content: [
        { type: 'paragraph', text: 'Amuletos são itens mágicos que concedem habilidades especiais. Existem três tipos: Ofensivo, Defensivo e Utilitário. Cada amuleto tem um período de recarga e um custo de energia. Os jogadores podem equipar até dois ao mesmo tempo.' }
    ]
  }
];


export const INITIAL_SCRIPT_DOCUMENTS: Document[] = [
  {
    id: 'script-1',
    title: 'Ato 1: O Despertar - Missão 1',
    category: 'Roteiro',
    // FIX: Added missing lastEdited property.
    lastEdited: '2024-01-01T00:00:00.000Z',
    content: [
      { type: 'heading', text: 'Cutscene de Abertura', level: 2 },
      { type: 'paragraph', text: 'A cena começa com Kael acordando em um beco chuvoso, sem memória. Uma figura misteriosa se aproxima e lhe entrega um amuleto brilhante antes de desaparecer nas sombras.' },
      { type: 'heading', text: 'Objetivos da Missão', level: 2 },
      { type: 'list', style: 'ordered', items: [
          'Siga o rastro da figura misteriosa.',
          'Aprenda a usar as habilidades básicas de combate.',
          'Encontre o primeiro refúgio seguro.'
      ]}
    ]
  },
  {
    id: 'script-2',
    title: 'Ato 1: O Despertar - Missão 2',
    category: 'Roteiro',
    // FIX: Added missing lastEdited property.
    lastEdited: '2024-01-01T00:00:00.000Z',
    content: [
        { type: 'heading', text: 'Encontrando o Mentor', level: 2 },
        { type: 'paragraph', text: 'Kael chega ao refúgio e encontra um velho chamado Elara, que explica a importância dos [[Amuletos]] e o perigo que se aproxima. Elara se torna o mentor de Kael.' },
        { type: 'heading', text: 'Diálogo Chave', level: 2 },
        { type: 'paragraph', text: 'Elara: "Esse amuleto... é parte de você agora. Ele o guiará, mas também o marcará como um alvo. Você deve aprender a controlá-lo antes que eles o encontrem."' }
    ]
  }
];