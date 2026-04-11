# Documentación Técnica del Sistema de Gestión de WhatsApp Business

## Descripción General

El sistema es una plataforma de gestión de pedidos a través de WhatsApp que integra múltiples componentes para automatizar el proceso de atención al cliente, análisis de conversaciones y gestión de pedidos. 

## Arquitectura del Sistema

### Componentes Principales

#### 1. Servidor Principal (index.js)

- __Framework__: Express.js
- __Puerto__: Configurable, por defecto 3000
- __Inicialización__: Conecta a MongoDB e inyecta las dependencias (colección y cliente) en los servicios mediante setters (`setCollection`, `setDbClient`), asegurando que los servicios tengan acceso a la base de datos sin importar el ciclo de vida del servidor.

#### 2. Rutas (routes/messages.routes.js)

El sistema expone un endpoint unificado para procesar tanto mensajes de clientes como acciones de administradores:

__Endpoint: POST /api/messages__

- **Detección de Origen**: Identifica si el mensaje proviene de un administrador consultando `admin-phones.json`.
- **Procesamiento de Comandos**: Si el remitente es admin y el contenido inicia con `/`, se ejecuta la lógica de `command.handler.js`.
- **Flujo de Cliente**: Si es un mensaje de cliente, se guarda inmediatamente en MongoDB y se delega al `message.processor.js` para análisis de IA.
- **Intercepción de Admin**: Detecta frases clave del admin en chats con clientes (ej: "Entonces te agendo:") para disparar flujos específicos como el de creación de pedidos.

#### 3. Servicio de MongoDB (services/mongo.service.js)

__Funciones principales:__

- __saveMessage()__: Guarda mensajes en la colección 'chatsV2' organizados por contacto (remoteJid).
- __getRecentMessages()__: Obtiene los últimos N mensajes de una conversación.
- __updateChatAnalysis()__: Actualiza estado y resumen contextual de la conversación.
- __getChatByJid()__: Obtiene el nombre del contacto por su JID.
- __saveOrderToDb()__: Guarda pedidos en la colección 'pedidos'.
- __getAllOrders()__: Obtiene todos los pedidos con posibilidad de filtrado y ordenamiento.
- __getNextOrderNumber()__: Genera números de pedido secuenciales (contador persistente en colección `counters`).
- __updateOrderStatusByNumber()__: Actualiza el estado de un pedido por su número.

#### 4. Procesador de Mensajes (services/message.processor.js)

- Coordina el procesamiento de mensajes entrantes.
- Gestiona temporizadores para análisis diferido de conversaciones (60 segundos de "tiempo de calma").
- Prioriza el manejo de eventos de agendamiento sobre el análisis de estado general.

#### 5. Manejadores de Eventos (services/message_events/)

- __order.handler.js__: Detecta el comando textual "Entonces te agendo:" enviado por un administrador en el chat de un cliente.
- __analysis.handler.js__: Implementa el sistema de espera antes de enviar la conversación a la IA para evitar análisis parciales mientras el cliente sigue escribiendo.

#### 6. Servicio de Análisis (services/analysis.service.js)

- Obtiene el historial reciente para dar contexto a la IA.
- Detecta automáticamente si la conversación ha derivado en un pedido o solo requiere actualización de estado.

#### 7. Servicio de Pedidos (services/order.service.js)

- Genera números de pedido secuenciales (iniciando en 297).
- **Manejo de Fechas**: Convierte las fechas recibidas de la IA (strings) a objetos `Date` de JavaScript para asegurar que MongoDB las procese correctamente en filtros y ordenamiento.
- **Zona Horaria**: Utiliza `Etc/GMT+3` (UTC-3) para normalizar la fecha y hora de los pedidos independientemente de la ubicación del servidor.

#### 8. Servicio de IA (services/ia.service.js)

- Interfaz para comunicación con servidor FastAPI.
- Configurable mediante variable de entorno `IA_SERVICE_URL`.

#### 9. Servicio ERP (erp-service)

- Microservicio en Python (FastAPI) para integración con ERPNext. Ubicado en su propio directorio en la raíz del proyecto.
- **Fase 1 (Lectura)**: Proveedor del endpoint para consultar pedidos activos (`Sales Orders` en estado `Submitted`) directo hacia ERPNext en reemplazo de MongoDB.
- Configurable mediante variable de entorno `ERP_SERVICE_URL` (por defecto `http://localhost:8001`).

#### 10. Manejador de Comandos (services/command.handler.js)

- Sistema modular que asigna comandos a archivos específicos en `services/commands/`.
- __Comandos disponibles__:
  - `/listado`: Lista todos los pedidos confirmados.
  - `/hoy`: Muestra pedidos con entrega para la fecha actual.
  - `/manana`: Muestra pedidos con entrega para el día siguiente.
  - `/hecho <numero>`: Marca un pedido como terminado (usa `completo.js`).
  - `/reactivar <numero>`: Cambia el estado de un pedido terminado de vuelta a confirmado.
  - `/erp`: Reservado para futura integración con ERPNext.

## Flujo de Trabajo

### Flujo de Mensajes de Clientes

1. Cliente envía mensaje → `/api/messages`.
2. Persistencia inmediata en `chatsV2`.
3. Inicio de temporizador de 60s. Si llega otro mensaje del mismo JID, el reloj se reinicia.
4. Al expirar el tiempo, la IA analiza la conversación.

### Flujo de Agendamiento de Pedidos

1. Admin escribe "Entonces te agendo:" en el chat del cliente.
2. El sistema detecta la frase, cancela cualquier análisis de estado pendiente.
3. Solicita a la IA extraer los datos estructurados del pedido del historial reciente.
4. Crea el documento en la colección `pedidos` con estado inicial `confirmado_por_admin`.

## Herramientas de Prueba

### Simulador de Mensajes
El proyecto incluye un simulador HTML para probar la lógica de recepción de mensajes y creación de pedidos sin necesidad de enviar mensajes reales por WhatsApp.

- **Ubicación**: `tests/message_simulator.html`
- **Uso**: 
  1. Ejecutar un servidor estático en la carpeta `tests` (ej: `npx serve -l 5000 tests`).
  2. Abrir en el navegador: `http://localhost:5000/message_simulator.html`.
  3. Configurar el JID del contacto y el contenido del mensaje para simular la interacción.

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
  fecha_hora_entrega: Date,     // Fecha y hora de entrega (BSON Date)
  monto_total: string,          // Monto total del pedido
  estado: string,               // Estado (confirmado_por_admin, terminado, etc.)
  aprobado_por_cliente: boolean,
  createdAt: Date
}
```

## Variables de Entorno

- `MONGODB_URI`: Cadena de conexión a MongoDB.
- `IA_SERVICE_URL`: URL del servicio de IA (FastAPI).
- `PORT`: Puerto del servidor (por defecto 3000).

## Consideraciones de Escalabilidad

- Los temporizadores de "tiempo de calma" se gestionan en memoria (`Map`). En un entorno con múltiples instancias (Load Balancer), se recomienda migrar estos temporizadores a **Redis**.

## Posibles Mejoras

1. Implementar autenticación para proteger el endpoint `/api/messages`.
2. Migrar la gestión de estados de mensajes a Redis para escalabilidad horizontal.
3. Finalizar la integración `/erp`.
4. Implementar validaciones de esquema con Joi o Zod para los payloads de la IA.