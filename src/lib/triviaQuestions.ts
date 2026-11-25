export type TriviaCategory =
  | 'Cultura general'
  | 'Videojuegos'
  | 'Anime y Manga'
  | 'Literatura'
  | 'Ciencia'
  | 'Tecnología';

export interface TriviaQuestion {
  id: string;
  category: TriviaCategory;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}

export const TRIVIA_QUESTION_BANK: readonly TriviaQuestion[] = [
  // ===================== CULTURA GENERAL (11) =====================
  {
    id: 'cg-01',
    category: 'Cultura general',
    question: '¿Cuál es el río más caudaloso del mundo?',
    options: ['Nilo', 'Amazonas', 'Yangtsé', 'Misisipi'],
    correctIndex: 1,
  },
  {
    id: 'cg-02',
    category: 'Cultura general',
    question: '¿En qué ciudad se encuentra la famosa obra arquitectónica de la Sagrada Familia?',
    options: ['Madrid', 'Valencia', 'Barcelona', 'Sevilla'],
    correctIndex: 2,
  },
  {
    id: 'cg-03',
    category: 'Cultura general',
    question: '¿Qué país tiene la mayor cantidad de islas registradas en el mundo?',
    options: ['Indonesia', 'Japón', 'Suecia', 'Filipinas'],
    correctIndex: 2,
  },
  {
    id: 'cg-04',
    category: 'Cultura general',
    question: '¿En qué año cayó el Muro de Berlín?',
    options: ['1985', '1989', '1991', '1993'],
    correctIndex: 1,
  },
  {
    id: 'cg-05',
    category: 'Cultura general',
    question: '¿Cuál es el idioma con más hablantes nativos en el planeta?',
    options: ['Inglés', 'Español', 'Chino mandarín', 'Hindi'],
    correctIndex: 2,
  },
  {
    id: 'cg-06',
    category: 'Cultura general',
    question: '¿Qué pintor renacentista realizó los frescos de la bóveda de la Capilla Sixtina?',
    options: ['Leonardo da Vinci', 'Rafael Sanzio', 'Miguel Ángel', 'Donatello'],
    correctIndex: 2,
  },
  {
    id: 'cg-07',
    category: 'Cultura general',
    question: '¿Cuál es la capital oficial de Australia?',
    options: ['Sídney', 'Melbourne', 'Canberra', 'Brisbane'],
    correctIndex: 2,
  },
  {
    id: 'cg-08',
    category: 'Cultura general',
    question: '¿Qué civilización antigua construyó la ciudadela de Machu Picchu?',
    options: ['Maya', 'Azteca', 'Inca', 'Olmeca'],
    correctIndex: 2,
  },
  {
    id: 'cg-09',
    category: 'Cultura general',
    question: '¿Cuál es el instrumento musical tradicional japonés de trece cuerdas pulsadas?',
    options: ['Shamisen', 'Koto', 'Shakuhachi', 'Taiko'],
    correctIndex: 1,
  },
  {
    id: 'cg-10',
    category: 'Cultura general',
    question: '¿Qué océano es el más extenso y profundo de la Tierra?',
    options: ['Atlántico', 'Índico', 'Pacífico', 'Ártico'],
    correctIndex: 2,
  },
  {
    id: 'cg-11',
    category: 'Cultura general',
    question: '¿Cuántos anillos entrelazados conforman el símbolo de los Juegos Olímpicos?',
    options: ['4', '5', '6', '7'],
    correctIndex: 1,
  },

  // ===================== VIDEOJUEGOS (11) =====================
  {
    id: 'vg-01',
    category: 'Videojuegos',
    question: '¿Cómo se llama el reino principal donde transcurren casi todas las entregas de The Legend of Zelda?',
    options: ['Termina', 'Hyrule', 'Lorule', 'Skyloft'],
    correctIndex: 1,
  },
  {
    id: 'vg-02',
    category: 'Videojuegos',
    question: '¿Qué estudio desarrolló el aclamado metroidvania independiente Hollow Knight?',
    options: ['Supergiant Games', 'Team Cherry', 'Moon Studios', 'Motion Twin'],
    correctIndex: 1,
  },
  {
    id: 'vg-03',
    category: 'Videojuegos',
    question: '¿En qué videojuego clásico de 1980 apareció Pac-Man por primera vez?',
    options: ['Arcade de Atari', 'Puck Man de Namco', 'Donkey Kong', 'Galaga'],
    correctIndex: 1,
  },
  {
    id: 'vg-04',
    category: 'Videojuegos',
    question: '¿Qué compositor creó las icónicas bandas sonoras de Chrono Trigger y Final Fantasy VI?',
    options: ['Koji Kondo', 'Nobuo Uematsu', 'Yoko Shimomura', 'Motoi Sakuraba'],
    correctIndex: 1,
  },
  {
    id: 'vg-05',
    category: 'Videojuegos',
    question: '¿Cuál es el nombre de la protagonista silenciosa de la saga Portal?',
    options: ['Alyx', 'Chell', 'Samus', 'Faith'],
    correctIndex: 1,
  },
  {
    id: 'vg-06',
    category: 'Videojuegos',
    question: '¿Qué videojuego de FromSoftware ganó el premio a Juego del Año en The Game Awards 2022?',
    options: ['Sekiro', 'Dark Souls III', 'Elden Ring', 'Bloodborne'],
    correctIndex: 2,
  },
  {
    id: 'vg-07',
    category: 'Videojuegos',
    question: '¿Cuál fue la consola doméstica más vendida de toda la historia de los videojuegos?',
    options: ['Nintendo Switch', 'PlayStation 2', 'Game Boy', 'PlayStation 4'],
    correctIndex: 1,
  },
  {
    id: 'vg-08',
    category: 'Videojuegos',
    question: '¿En Minecraft, qué mineral se requiere como mínimo para fabricar un pico capaz de minar obsidiana?',
    options: ['Hierro', 'Oro', 'Diamante', 'Cobre'],
    correctIndex: 2,
  },
  {
    id: 'vg-09',
    category: 'Videojuegos',
    question: '¿Cómo se llama el planeta de origen de la cazarrecompensas Samus Aran en Metroid?',
    options: ['Zebes', 'K-2L', 'Tallon IV', 'SR388'],
    correctIndex: 1,
  },
  {
    id: 'vg-10',
    category: 'Videojuegos',
    question: '¿Qué clásico de estrategia popularizó el género MOBA a partir de un mapa personalizado de Warcraft III?',
    options: ['StarCraft', 'Defense of the Ancients (DotA)', 'Age of Mythology', 'Heroes of Might'],
    correctIndex: 1,
  },
  {
    id: 'vg-11',
    category: 'Videojuegos',
    question: '¿Cuál es el nombre de la ciudad submarina donde se desarrolla el primer BioShock?',
    options: ['Columbia', 'Rapture', 'Dunwall', 'Midgar'],
    correctIndex: 1,
  },

  // ===================== ANIME Y MANGA (11) =====================
  {
    id: 'am-01',
    category: 'Anime y Manga',
    question: '¿Quién es el autor y mangaka creador de One Piece?',
    options: ['Masashi Kishimoto', 'Eiichiro Oda', 'Tite Kubo', 'Akira Toriyama'],
    correctIndex: 1,
  },
  {
    id: 'am-02',
    category: 'Anime y Manga',
    question: '¿Qué película de Studio Ghibli ganó el Óscar a Mejor Película de Animación en 2003?',
    options: ['Mi vecino Totoro', 'La princesa Mononoke', 'El viaje de Chihiro', 'El castillo ambulante'],
    correctIndex: 2,
  },
  {
    id: 'am-03',
    category: 'Anime y Manga',
    question: '¿Cómo se llama el cuaderno sobrenatural que utiliza Light Yagami en Death Note?',
    options: ['Shinigami Book', 'Death Note', 'Soul Grimoire', 'Black Ledger'],
    correctIndex: 1,
  },
  {
    id: 'am-04',
    category: 'Anime y Manga',
    question: 'En Fullmetal Alchemist, ¿cuál es el principio fundamental que rige toda la alquimia?',
    options: ['Ley del Karma', 'Intercambio Equivalente', 'Círculo Eterno', 'Resonancia Astral'],
    correctIndex: 1,
  },
  {
    id: 'am-05',
    category: 'Anime y Manga',
    question: '¿Cómo se llama el protagonista del manhwa coreano Solo Leveling?',
    options: ['Bam', 'Sung Jin-Woo', 'Mori Jin', 'Arthur Leywin'],
    correctIndex: 1,
  },
  {
    id: 'am-06',
    category: 'Anime y Manga',
    question: '¿Qué estudio de animación produjo Demon Slayer (Kimetsu no Yaiba)?',
    options: ['MAPPA', 'Bones', 'Ufotable', 'Wit Studio'],
    correctIndex: 2,
  },
  {
    id: 'am-07',
    category: 'Anime y Manga',
    question: 'En Attack on Titan (Shingeki no Kyojin), ¿cómo se llama la muralla más externa?',
    options: ['Muralla Rose', 'Muralla Sina', 'Muralla María', 'Muralla Paradis'],
    correctIndex: 2,
  },
  {
    id: 'am-08',
    category: 'Anime y Manga',
    question: '¿Cuál es el nombre de la nave espacial tripulada por Spike Spiegel en Cowboy Bebop?',
    options: ['Swordfish II', 'Bebop', 'Outlaw Star', 'Red Tail'],
    correctIndex: 1,
  },
  {
    id: 'am-09',
    category: 'Anime y Manga',
    question: '¿Qué mangaka creó las obras maestras Monster y 20th Century Boys?',
    options: ['Kentaro Miura', 'Naoki Urasawa', 'Takehiko Inoue', 'Yoshihiro Togashi'],
    correctIndex: 1,
  },
  {
    id: 'am-10',
    category: 'Anime y Manga',
    question: 'En Frieren: Más allá del final del viaje, ¿cuántos años duró la aventura original del grupo del héroe Himmel?',
    options: ['5 años', '10 años', '20 años', '50 años'],
    correctIndex: 1,
  },
  {
    id: 'am-11',
    category: 'Anime y Manga',
    question: '¿Cómo se denomina el sistema de energía vital utilizado por los cazadores en Hunter × Hunter?',
    options: ['Chakra', 'Nen', 'Reiatsu', 'Haki'],
    correctIndex: 1,
  },

  // ===================== LITERATURA (11) =====================
  {
    id: 'lt-01',
    category: 'Literatura',
    question: '¿Quién escribió la novela "Cien años de soledad"?',
    options: ['Julio Cortázar', 'Mario Vargas Llosa', 'Gabriel García Márquez', 'Jorge Luis Borges'],
    correctIndex: 2,
  },
  {
    id: 'lt-02',
    category: 'Literatura',
    question: '¿Cuál es el apellido de la familia protagonista en la saga "Dune" de Frank Herbert?',
    options: ['Harkonnen', 'Atreides', 'Corrino', 'Fremen'],
    correctIndex: 1,
  },
  {
    id: 'lt-03',
    category: 'Literatura',
    question: '¿Qué autora británica publicó "Frankenstein o el moderno Prometeo" en 1818?',
    options: ['Jane Austen', 'Mary Shelley', 'Emily Brontë', 'Virginia Woolf'],
    correctIndex: 1,
  },
  {
    id: 'lt-04',
    category: 'Literatura',
    question: '¿Cómo se llama el sistema de magia basado en metales creado por Brandon Sanderson en "Nacidos de la Bruma"?',
    options: ['Surgebinding', 'Alomancia', 'Simpatía', 'Taumaturgia'],
    correctIndex: 1,
  },
  {
    id: 'lt-05',
    category: 'Literatura',
    question: '¿En qué novela distópica de George Orwell aparece la figura del Gran Hermano?',
    options: ['Un mundo feliz', 'Fahrenheit 451', '1984', 'Rebelión en la granja'],
    correctIndex: 2,
  },
  {
    id: 'lt-06',
    category: 'Literatura',
    question: '¿Quién es el autor de "El nombre del viento", primera parte de la Crónica del Asesino de Reyes?',
    options: ['George R. R. Martin', 'Patrick Rothfuss', 'Joe Abercrombie', 'Robert Jordan'],
    correctIndex: 1,
  },
  {
    id: 'lt-07',
    category: 'Literatura',
    question: '¿Qué escritor mexicano creó el universo fantasmal de Comala en "Pedro Páramo"?',
    options: ['Carlos Fuentes', 'Octavio Paz', 'Juan Rulfo', 'Elena Garro'],
    correctIndex: 2,
  },
  {
    id: 'lt-08',
    category: 'Literatura',
    question: '¿Cuál es el título de la obra de Miguel de Cervantes considerada la primera novela moderna?',
    options: ['La Celestina', 'Don Quijote de la Mancha', 'La Galatea', 'El Lazarillo'],
    correctIndex: 1,
  },
  {
    id: 'lt-09',
    category: 'Literatura',
    question: '¿Qué poeta y escritor argentino es célebre por relatos laberínticos como "El Aleph" y "Ficciones"?',
    options: ['Jorge Luis Borges', 'Ernesto Sabato', 'Adolfo Bioy Casares', 'Roberto Arlt'],
    correctIndex: 0,
  },
  {
    id: 'lt-10',
    category: 'Literatura',
    question: '¿En qué obra de Dante Alighieri el poeta Virgilio guía al protagonista a través del Infierno y el Purgatorio?',
    options: ['El Decamerón', 'La Divina Comedia', 'La Eneida', 'El Paraíso Perdido'],
    correctIndex: 1,
  },
  {
    id: 'lt-11',
    category: 'Literatura',
    question: '¿Quién escribió la trilogía de ciencia ficción "El problema de los tres cuerpos"?',
    options: ['Ted Chiang', 'Ken Liu', 'Cixin Liu', 'Isaac Asimov'],
    correctIndex: 2,
  },

  // ===================== CIENCIA (10) =====================
  {
    id: 'ci-01',
    category: 'Ciencia',
    question: '¿Cuál es el elemento químico más abundante en el universo observable?',
    options: ['Oxígeno', 'Helio', 'Hidrógeno', 'Carbono'],
    correctIndex: 2,
  },
  {
    id: 'ci-02',
    category: 'Ciencia',
    question: '¿Qué planeta del sistema solar tiene la rotación más rápida sobre su propio eje?',
    options: ['Mercurio', 'Marte', 'Júpiter', 'Saturno'],
    correctIndex: 2,
  },
  {
    id: 'ci-03',
    category: 'Ciencia',
    question: '¿Aproximadamente cuánto tarda la luz del Sol en llegar a la Tierra?',
    options: ['8 segundos', '8 minutos', '45 minutos', '2 horas'],
    correctIndex: 1,
  },
  {
    id: 'ci-04',
    category: 'Ciencia',
    question: '¿Qué orgánulo celular es conocido como la central energética de las células eucariotas?',
    options: ['Ribosoma', 'Mitocondria', 'Lisosoma', 'Aparato de Golgi'],
    correctIndex: 1,
  },
  {
    id: 'ci-05',
    category: 'Ciencia',
    question: '¿Cuál es el símbolo químico del oro en la tabla periódica?',
    options: ['Ag', 'Gd', 'Au', 'Or'],
    correctIndex: 2,
  },
  {
    id: 'ci-06',
    category: 'Ciencia',
    question: '¿Qué científica fue la primera persona en ganar dos premios Nobel en disciplinas científicas distintas?',
    options: ['Rosalind Franklin', 'Marie Curie', 'Ada Lovelace', 'Lise Meitner'],
    correctIndex: 1,
  },
  {
    id: 'ci-07',
    category: 'Ciencia',
    question: '¿Qué unidad del Sistema Internacional mide la frecuencia de una onda?',
    options: ['Vatio', 'Hercio (Hz)', 'Julio', 'Pascal'],
    correctIndex: 1,
  },
  {
    id: 'ci-08',
    category: 'Ciencia',
    question: '¿Cuál es la galaxia espiral más grande y cercana a la Vía Láctea?',
    options: ['Triángulo', 'Andrómeda', 'Sombrero', 'Centaurus A'],
    correctIndex: 1,
  },
  {
    id: 'ci-09',
    category: 'Ciencia',
    question: '¿Qué fenómeno óptico explica por qué el cielo diurno se ve azul desde la superficie terrestre?',
    options: ['Efecto Doppler', 'Dispersión de Rayleigh', 'Refracción total', 'Efecto fotoeléctrico'],
    correctIndex: 1,
  },
  {
    id: 'ci-10',
    category: 'Ciencia',
    question: '¿Cuál es el metal que se encuentra en estado líquido a temperatura ambiente estándar?',
    options: ['Galio', 'Mercurio', 'Plomo', 'Sodio'],
    correctIndex: 1,
  },

  // ===================== TECNOLOGÍA (10) =====================
  {
    id: 'tc-01',
    category: 'Tecnología',
    question: '¿Qué significan las siglas HTTP en la arquitectura de la Web?',
    options: [
      'HyperText Transfer Protocol',
      'High Transmission Text Path',
      'Hyperlink Terminal Transport Process',
      'Host Transfer Type Protocol',
    ],
    correctIndex: 0,
  },
  {
    id: 'tc-02',
    category: 'Tecnología',
    question: '¿Quién creó el núcleo (kernel) de Linux en 1991?',
    options: ['Richard Stallman', 'Linus Torvalds', 'Ken Thompson', 'Dennis Ritchie'],
    correctIndex: 1,
  },
  {
    id: 'tc-03',
    category: 'Tecnología',
    question: '¿Cuántos bits conforman exactamente un byte estándar moderno?',
    options: ['4 bits', '8 bits', '16 bits', '32 bits'],
    correctIndex: 1,
  },
  {
    id: 'tc-04',
    category: 'Tecnología',
    question: '¿Qué lenguaje de programación fue diseñado por Brendan Eich en 1995 para los navegadores web?',
    options: ['Python', 'Java', 'JavaScript', 'Ruby'],
    correctIndex: 2,
  },
  {
    id: 'tc-05',
    category: 'Tecnología',
    question: '¿Qué código de estado HTTP indica que un recurso solicitado no fue encontrado?',
    options: ['200', '301', '403', '404'],
    correctIndex: 3,
  },
  {
    id: 'tc-06',
    category: 'Tecnología',
    question: '¿Quién es ampliamente reconocida como la primera programadora de la historia por su algoritmo para la Máquina Analítica?',
    options: ['Grace Hopper', 'Ada Lovelace', 'Margaret Hamilton', 'Katherine Johnson'],
    correctIndex: 1,
  },
  {
    id: 'tc-07',
    category: 'Tecnología',
    question: '¿Qué estructura de datos sigue estrictamente el principio LIFO (último en entrar, primero en salir)?',
    options: ['Cola (Queue)', 'Pila (Stack)', 'Árbol binario', 'Tabla hash'],
    correctIndex: 1,
  },
  {
    id: 'tc-08',
    category: 'Tecnología',
    question: '¿Qué sistema de control de versiones distribuido es el estándar de la industria del software?',
    options: ['Subversion', 'Git', 'CVS', 'FTP'],
    correctIndex: 1,
  },
  {
    id: 'tc-09',
    category: 'Tecnología',
    question: '¿Qué protocolo criptográfico protege la comunicación en HTTPS hoy en día?',
    options: ['TLS', 'SMTP', 'SNMP', 'ICMP'],
    correctIndex: 0,
  },
  {
    id: 'tc-10',
    category: 'Tecnología',
    question: '¿En qué unidad se mide habitualmente la velocidad de reloj de un procesador moderno?',
    options: ['Megabytes (MB)', 'Gigahercios (GHz)', 'Lúmenes (lm)', 'Amperios (A)'],
    correctIndex: 1,
  },
];

export function shuffleTriviaQuestions(): TriviaQuestion[] {
  const copy = [...TRIVIA_QUESTION_BANK];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
