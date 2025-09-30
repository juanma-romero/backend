# Documentación Técnica del Sistema de Gestión de WhatsApp Business

## Descripción General

El sistema es una plataforma de gestión de pedidos a través de WhatsApp que integra múltiples componentes para automatizar el proceso de atención al cliente, análisis de conversaciones y gestión de pedidos. El sistema consta de dos servidores principales:

1. __Servidor 'dash'__: Utiliza la librería Baileys para recibir mensajes de clientes a través de WhatsApp
2. __Servidor 'wabi'__: Utiliza la API de WhatsApp para procesar comandos de administradores

## Arquitectura del Sistema

### Componentes Principales

#### 1. Servidor Principal (index.js)

- __Framework__: Express.js
- __Puerto__: Configurable, por defecto 3000
- __Función__: Orquestador de rutas y conexión a base de datos
- __Conexión a MongoDB__: Se inicializa al arrancar el servidor, inyectando la colección 'chatsV2' en los servicios

#### 2. Rutas (routes/messages.routes.js)

El sistema expone dos endpoints principales:

__Endpoint: POST /api/messages__

- Recibe mensajes de clientes provenientes del servidor 'dash'
- Guarda inmediatamente el mensaje en MongoDB
- Procesa el mensaje para análisis de IA
- Retorna status 200

__Endpoint: POST /api/whatsapp-inbound__

- Recibe comandos de administradores del servidor 'wabi'

- Procesa dos formatos de payload:

  - Formato WABI: `{ "message": "/listado" }`
  - Formato simulador: `{ "message": { "text": { "body": "/listado" } } }`

- Ejecuta comandos de administrador si comienza con '/'

- Retorna respuesta al comando o status 200

#### 3. Servicio de MongoDB (services/mongo.service.js)

__Funciones principales:__

- __saveMessage()__: Guarda mensajes en la colección 'chatsV2' organizados por contacto (remoteJid)
- __getRecentMessages()__: Obtiene los últimos N mensajes de una conversación
- __updateChatAnalysis()__: Actualiza estado y resumen contextual de la conversación
- __getChatByJid()__: Obtiene el nombre del contacto por su JID
- __saveOrderToDb()__: Guarda pedidos en la colección 'pedidos'
- __getAllOrders()__: Obtiene todos los pedidos con posibilidad de filtrado y ordenamiento
- __getNextOrderNumber()__: Genera números de pedido secuenciales (inicia en 297)
- __updateOrderStatusByNumber()__: Actualiza el estado de un pedido por su número

#### 4. Procesador de Mensajes (services/message.processor.js)

- Coordina el procesamiento de mensajes entrantes
- Gestiona temporizadores para análisis diferido de conversaciones
- Prioriza el manejo de comandos de agendamiento de pedidos
- Delega a los manejadores específicos según el tipo de mensaje

#### 5. Manejadores de Eventos (services/message_events/)

- __order.handler.js__: Detecta el comando "Entonces te agendo:" del admin y dispara análisis de pedido
- __analysis.handler.js__: Implementa un sistema de "tiempo de calma" de 60 segundos antes de analizar la conversación

#### 6. Servicio de Análisis (services/analysis.service.js)

- Obtiene los últimos 15 mensajes de una conversación
- Formatea los mensajes para enviar a la IA
- Detecta si hay un pedido o solo análisis de estado
- Actualiza el estado de la conversación según el análisis

#### 7. Servicio de Pedidos (services/order.service.js)

- Obtiene los últimos 20 mensajes para contexto de pedido
- Genera números de pedido secuenciales
- Crea documentos de pedido en la base de datos
- Convierte fechas de string a objetos Date para MongoDB
- Actualiza el estado de la conversación a 'Pedido Creado'

#### 8. Servicio de IA (services/ia.service.js)

- Interfaz para comunicación con servidor FastAPI que conecta con API de IA
- Endpoints disponibles: `/analyze-conversation` y `/analyze-order`
- Configurable mediante variable de entorno `IA_SERVICE_URL`

#### 9. Manejador de Comandos (services/command.handler.js)

- Sistema modular para comandos de administrador

- Comandos disponibles:

  - `/listado`: Lista pedidos confirmados
  - `/hoy`: Lista pedidos para hoy
  - `/manana`: Lista pedidos para mañana
  - `/hecho`: Marca pedido como completado
  - `/reactivar`: Reactiva pedido
  - `/odoo`: Comando para integración con Odoo

## Flujo de Trabajo

### Flujo de Mensajes de Clientes

1. Cliente envía mensaje por WhatsApp → Servidor 'dash' (Baileys) → Servidor backend endpoint `/api/messages`
2. Mensaje se guarda inmediatamente en MongoDB (colección 'chatsV2')
3. Mensaje se procesa para análisis (60 segundos de espera por posibles respuestas)
4. IA analiza la conversación y actualiza estado/resumen
5. Si se detecta pedido, se crea documento en colección 'pedidos'

### Flujo de Comandos de Administrador

1. Admin envía comando por WhatsApp → Servidor 'wabi' (API WhatsApp) → Servidor backend endpoint `/api/whatsapp-inbound`
2. Sistema identifica y ejecuta el comando correspondiente
3. Se devuelve respuesta al administrador

### Flujo de Agendamiento de Pedidos

1. Admin responde a cliente con "Entonces te agendo:"
2. Sistema detiene temporizador de análisis de estado
3. Se dispara análisis específico de pedido
4. IA extrae información del pedido
5. Se crea documento de pedido en MongoDB
6. Se actualiza estado de conversación a 'Pedido Creado'

## Estructura de Datos

### Colección 'chatsV2'

```javascript
{
  _id: ObjectId,
 contactJid: string,           // Identificador único del contacto
  contactName: string,          // Nombre del contacto (si disponible)
  messages: [Message],          // Array de mensajes
  stateConversation: string,    // Estado actual de la conversación
  contextualSummary: string,    // Resumen contextual de la conversación
  createdAt: Date,
  updatedAt: Date
}
```

### Colección 'pedidos'

```javascript
{
  _id: ObjectId,
 numero_pedido: number,        // Número secuencial
  remoteJid: string,            // Identificador del contacto
  contactName: string,          // Nombre del cliente
  productos: [Product],         // Array de productos
  fecha_hora_entrega: Date,     // Fecha y hora de entrega
  monto_total: string,          // Monto total del pedido
  estado: string,               // Estado del pedido
  aprobado_por_cliente: boolean, // Aprobación del cliente
  createdAt: Date
}
```

### Colección 'counters'

```javascript
{
  _id: 'orderNumber',
  sequence_value: number        // Último número de pedido asignado
}
```

## Variables de Entorno

- `MONGODB_URI`: Cadena de conexión a MongoDB Atlas
- `IA_SERVICE_URL`: URL del servicio de inteligencia artificial
- `PORT`: Puerto del servidor (opcional, por defecto 3000)

## Consideraciones de Seguridad

- El sistema no implementa autenticación explícita en los endpoints
- Se recomienda proteger los endpoints con autenticación apropiada
- Las variables sensibles se gestionan con dotenv

## Consideraciones de Escalabilidad

- El sistema utiliza un Map() para gestionar temporizadores en memoria
- En entornos de múltiples instancias, esta estrategia podría no funcionar correctamente
- Considerar uso de Redis o base de datos para persistencia de temporizadores

## Dependencias Principales

- express: Framework web
- mongodb: Driver de MongoDB
- axios: Cliente HTTP para comunicación con IA
- dotenv: Gestión de variables de entorno
- cors: Configuración de políticas CORS

## Posibles Mejoras

1. Implementar autenticación JWT para proteger endpoints
2. Agregar logging estructurado con niveles
3. Implementar manejo de errores global
4. Agregar validación de entrada de datos
5. Considerar uso de Redis para temporizadores en entornos escalables
6. Implementar pruebas unitarias e integración
7. Agregar monitoreo y métricas