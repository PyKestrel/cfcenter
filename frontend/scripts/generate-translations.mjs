/**
 * Generate translation files for new locales from en.json
 * 
 * Strategy: Start with English as base, then apply known translations
 * for the most visible UI strings (common, navigation, auth, errors, etc.)
 * 
 * Run: node scripts/generate-translations.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const messagesDir = path.join(__dirname, '..', 'src', 'messages')

const en = JSON.parse(fs.readFileSync(path.join(messagesDir, 'en.json'), 'utf8'))

// Deep clone helper
const clone = obj => JSON.parse(JSON.stringify(obj))

// Deep merge: applies overrides on top of base
function deepMerge(base, overrides) {
  const result = clone(base)
  for (const key of Object.keys(overrides)) {
    if (typeof overrides[key] === 'object' && overrides[key] !== null && !Array.isArray(overrides[key]) && typeof result[key] === 'object') {
      result[key] = deepMerge(result[key], overrides[key])
    } else {
      result[key] = overrides[key]
    }
  }
  return result
}

// ─── Spanish (es) ───────────────────────────────────────────────────────────
const es = {
  common: {
    add: "Añadir", edit: "Editar", delete: "Eliminar", save: "Guardar", cancel: "Cancelar",
    confirm: "Confirmar", close: "Cerrar", search: "Buscar", loading: "Cargando...",
    saving: "Guardando...", deleting: "Eliminando...", error: "Error", success: "Éxito",
    warning: "Advertencia", info: "Información", yes: "Sí", no: "No", ok: "OK",
    retry: "Reintentar", refresh: "Actualizar", back: "Atrás", goBack: "Volver",
    next: "Siguiente", previous: "Anterior", all: "Todos", none: "Ninguno",
    select: "Seleccionar", actions: "Acciones", status: "Estado", name: "Nombre",
    description: "Descripción", type: "Tipo", date: "Fecha", size: "Tamaño",
    enabled: "Activado", disabled: "Desactivado", active: "Activo", inactive: "Inactivo",
    online: "En línea", offline: "Fuera de línea", unknown: "Desconocido", total: "Total",
    used: "Usado", free: "Libre", available: "Disponible", memShort: "Mem",
    memory: "Memoria", details: "Detalles", configuration: "Configuración",
    confirmDelete: "Confirmar eliminación",
    deleteConfirmation: "¿Está seguro de que desea eliminar este elemento?",
    noData: "Sin datos", noResults: "Sin resultados", notAvailable: "No disponible",
    copy: "Copiar", copied: "¡Copiado!", download: "Descargar", upload: "Subir",
    export: "Exportar", import: "Importar", filter: "Filtrar", sort: "Ordenar",
    reset: "Restablecer", apply: "Aplicar", create: "Crear", update: "Actualizar",
    view: "Ver", more: "Más", less: "Menos", showMore: "Mostrar más",
    showLess: "Mostrar menos", expandAll: "Expandir todo", collapseAll: "Contraer todo",
    optional: "opcional", show: "Mostrar", hide: "Ocultar", color: "Color",
    comingSoon: "Próximamente", loadVms: "Cargar VMs", default: "Predeterminado",
    node: "Nodo", darkMode: "Modo oscuro", lightMode: "Modo claro",
    healthy: "Saludable", unhealthy: "No saludable",
    updateAvailable: "Actualización disponible", logout: "Cerrar sesión"
  },
  auth: {
    welcomeTitle: "Bienvenido a CFCenter",
    loginSubtitle: "Inicie sesión para acceder a su infraestructura",
    loginMethod: "Método de inicio de sesión", localAccount: "Cuenta local",
    ldapAd: "LDAP / Active Directory", username: "Usuario", password: "Contraseña",
    rememberMe: "Recordarme", forgotPassword: "¿Olvidó su contraseña?",
    loggingIn: "Iniciando sesión...", login: "Iniciar sesión",
    logout: "Cerrar sesión", loggingOut: "Cerrando sesión...",
    loginError: "Error de inicio de sesión", notAuthenticated: "No autenticado",
    notAuthorized: "No autorizado", sessionExpired: "Sesión expirada",
    invalidCredentials: "Credenciales inválidas",
    appSubtitle: "Gestión centralizada de Proxmox",
    usernamePlaceholder: "usuario o user@dominio.com"
  },
  navigation: {
    dashboard: "Panel", infrastructure: "Infraestructura", inventory: "Inventario",
    storage: "Almacenamiento", ceph: "Ceph", backups: "Copias de seguridad",
    resources: "Recursos", orchestration: "Orquestación", drs: "DRS",
    siteRecovery: "Recuperación de sitio", networkSecurity: "Seguridad de red",
    operations: "Operaciones", events: "Eventos", alerts: "Alertas",
    jobs: "Centro de tareas", monitoring: "Monitorización",
    securityAccess: "Seguridad y acceso", users: "Usuarios",
    rbacRoles: "RBAC / Roles", auditLogs: "Auditoría y registros",
    settings: "Configuración", license: "Licencia", about: "Acerca de",
    templates: "Plantillas", reports: "Informes", topology: "Topología",
    profile: "Perfil"
  },
  navbar: {
    language: "Idioma", theme: "Tema", aiAssistant: "Asistente IA",
    notifications: "Notificaciones", profile: "Perfil", search: "Buscar",
    searchPlaceholder: "Escriba para buscar… (Clústeres, Nodos, VMs)",
    searchTip: "Consejo: Ctrl/Cmd + K para abrir, ESC para cerrar."
  },
  time: {
    justNow: "ahora mismo", secondsAgo: "hace unos segundos",
    minutesAgo: "hace {count} min", hoursAgo: "hace {count}h",
    daysAgo: "hace {count}d", synced: "Sincronizado {time}"
  },
  license: {
    enterpriseRequired: "Se requiere licencia Enterprise",
    upgradeToEnterprise: "Actualizar a Enterprise",
    featureNotAvailable: "Esta función requiere una licencia Enterprise",
    expirationWarning: "Su licencia expira en {days} días",
    featureRestricted: "Función Enterprise",
    featureRequiresEnterprise: "La función \"{feature}\" requiere una licencia Enterprise.",
    thisFeatureRequiresEnterprise: "Esta función requiere una licencia Enterprise para su uso."
  },
  user: {
    defaultName: "Usuario", admin: "Administrador", operator: "Operador",
    viewer: "Visor", adminDesc: "Acceso completo a todas las funciones",
    operatorDesc: "Gestión de VMs y contenedores", viewerDesc: "Acceso de solo lectura"
  },
  dashboard: {
    title: "Panel", loadingError: "Error al cargar el panel",
    widgets: {
      quickStats: "Estadísticas rápidas", alerts: "Alertas",
      backups: "Copias de seguridad", storage: "Almacenamiento",
      resources: "Recursos", nodes: "Nodos", vms: "Máquinas virtuales",
      activity: "Actividad", security: "Seguridad / Zero Trust",
      ceph: "Estado Ceph", pbs: "Resumen PBS",
      topConsumers: "Mayores consumidores", uptimeNodes: "Tiempo activo de nodos"
    }
  },
  alerts: {
    title: "Alertas", noActiveAlerts: "Sin alertas activas",
    allSystemsNormal: "Todos los sistemas funcionan normalmente",
    critical: "crítico", warning: "advertencia",
    acknowledge: "Reconocer", resolve: "Resolver",
    viewAll: "Ver todas las alertas"
  },
  errors: {
    serverError: "Error del servidor", loadingError: "Error al cargar",
    updateError: "Error al actualizar", addError: "Error al añadir",
    deleteError: "Error al eliminar", moveError: "Error al mover",
    connectionError: "Error de conexión", apiError: "Error de API",
    notFound: "No encontrado", pageNotFound: "Página no encontrada",
    httpError: "Error {status}"
  },
  errorPages: {
    "404": { title: "Página no encontrada", description: "La página que busca no existe o ha sido movida." },
    "500": { title: "Error del servidor", description: "Ocurrió un error inesperado. Por favor, inténtelo de nuevo más tarde." },
    "403": { title: "Acceso denegado", description: "No tiene los permisos necesarios para acceder a esta página." },
    "401": { title: "No autenticado", description: "Debe iniciar sesión para acceder a esta página." },
    "503": { title: "Servicio no disponible", description: "El servicio no está disponible temporalmente." },
    backToHome: "Volver al inicio", retry: "Reintentar",
    criticalError: "Error crítico", errorOccurred: "Ocurrió un error",
    unexpectedError: "Ocurrió un error inesperado.",
    metaTitle: "404 - Página no encontrada | CFCenter"
  },
  setup: {
    title: "Configuración inicial",
    subtitle: "Cree su cuenta de administrador para comenzar",
    passwordMismatch: "Las contraseñas no coinciden",
    passwordMinLength: "La contraseña debe tener al menos 8 caracteres",
    creationError: "Error al crear la cuenta",
    serverError: "Error de conexión al servidor",
    successMessage: "¡Cuenta creada correctamente! Redirigiendo al inicio de sesión...",
    nameLabel: "Nombre (opcional)", emailLabel: "Email",
    passwordLabel: "Contraseña", passwordHelper: "Mínimo 8 caracteres",
    confirmPasswordLabel: "Confirmar contraseña",
    createAccount: "Crear cuenta de administrador", creating: "Creando...",
    adminRightsInfo: "Esta cuenta tendrá derechos completos de administrador en CFCenter."
  },
  vmActions: {
    start: "Iniciar", stop: "Detener", shutdown: "Apagar (ACPI)",
    forceStop: "Forzar detención", pause: "Pausar", resume: "Reanudar",
    restart: "Reiniciar", console: "Consola", migrate: "Migrar",
    clone: "Clonar", details: "Detalles",
    deployFromTemplate: "Desplegar desde esta plantilla"
  },
  settings: {
    title: "Configuración", subtitle: "Configuración de la cuenta",
    welcome: "Bienvenido a CFCenter",
    connections: "Conexiones", addConnection: "Añadir conexión",
    saveChanges: "Guardar cambios", appearance: "Apariencia",
    notifications: "Notificaciones", security: "Seguridad",
    ai: "Inteligencia artificial", license: "Licencia"
  },
  profile: {
    title: "Perfil", updated: "Perfil actualizado correctamente",
    personalInfo: "Información personal", changePassword: "Cambiar contraseña",
    preferences: "Preferencias", avatar: "Avatar"
  },
  inventory: {
    title: "Inventario", vms: "Máquinas virtuales", containers: "Contenedores",
    nodes: "Nodos", clusters: "Clústeres"
  },
  storage: {
    title: "Almacenamiento", overview: "Resumen", ceph: "Ceph",
    distributed: "Almacenamiento distribuido Ceph"
  },
  backups: {
    title: "Copias de seguridad", subtitle: "Gestión de copias PBS"
  },
  drs: {
    title: "DRS", subtitle: "Planificador de recursos distribuidos"
  },
  events: {
    title: "Eventos", recent: "Eventos recientes", all: "Todos los eventos"
  },
  security: {
    title: "Seguridad", users: "Usuarios", rbac: "RBAC / Roles",
    audit: "Auditoría y registros"
  },
  audit: {
    title: "Auditoría y registros", today: "Hoy", totalEvents: "Total de eventos"
  },
  jobs: {
    title: "Centro de tareas", running: "En ejecución", completed: "Completado",
    failed: "Fallido", pending: "Pendiente", scheduled: "Programado"
  },
  console: {
    title: "Consola", fullscreen: "Pantalla completa",
    connecting: "Conectando a la consola...", notAvailable: "Consola no disponible",
    reconnect: "Reconectar", connected: "Conectado"
  },
  about: {
    title: "Acerca de", description: "Plataforma de gestión multi-clúster Proxmox",
    currentVersion: "Versión actual", latestVersion: "Última versión",
    updateAvailable: "Actualización disponible", upToDate: "Actualizado",
    changelog: "Historial de versiones", copyright: "Todos los derechos reservados."
  },
  commandPalette: {
    placeholder: "Buscar páginas, VMs, nodos, PBS...",
    pages: "Páginas", virtualMachines: "Máquinas virtuales",
    nodes: "Nodos PVE", noResults: "Sin resultados",
    navigate: "navegar", select: "seleccionar", close: "cerrar"
  },
  emptyState: {
    noEvents: "Sin eventos", noAlerts: "Sin alertas",
    noJobs: "Sin tareas", noBackups: "Sin copias de seguridad",
    noUsers: "Sin usuarios", noConnections: "Sin conexiones"
  },
  topology: {
    title: "Topología de infraestructura",
    filterByConnection: "Filtrar por conexión",
    allConnections: "Todas las conexiones",
    fitView: "Ajustar vista", noData: "Sin datos de topología"
  },
  reports: {
    title: "Informes", description: "Generar y programar informes PDF",
    generate: "Generar", history: "Historial", schedules: "Programaciones"
  },
  ai: {
    title: "Asistente IA", thinking: "Pensando...",
    clearConversation: "Limpiar conversación",
    welcomeTitle: "¡Hola! 👋",
    askQuestion: "Haga su pregunta..."
  },
  siteRecovery: {
    title: "Recuperación de sitio",
    subtitle: "Replicación Ceph RBD entre clústeres y recuperación ante desastres"
  },
  resources: {
    infrastructureHealth: "Salud de la infraestructura",
    efficiency: "Eficiencia", capacityForecasts: "Previsiones de capacidad",
    recommendations: "Recomendaciones",
    environmentalImpact: "Impacto ambiental / RSE"
  },
  monitoring: {
    title: "Monitorización", cpu: "CPU", memory: "Memoria",
    disk: "Disco", network: "Red", iops: "IOPS"
  },
  pxcore: {
    operational: "PXCore operativo", degraded: "PXCore degradado",
    error: "Error de PXCore", offline: "PXCore fuera de línea"
  }
}

// ─── German (de) ────────────────────────────────────────────────────────────
const de = {
  common: {
    add: "Hinzufügen", edit: "Bearbeiten", delete: "Löschen", save: "Speichern",
    cancel: "Abbrechen", confirm: "Bestätigen", close: "Schließen", search: "Suchen",
    loading: "Laden...", saving: "Speichern...", deleting: "Löschen...",
    error: "Fehler", success: "Erfolg", warning: "Warnung", info: "Information",
    yes: "Ja", no: "Nein", ok: "OK", retry: "Wiederholen", refresh: "Aktualisieren",
    back: "Zurück", goBack: "Zurück", next: "Weiter", previous: "Zurück",
    all: "Alle", none: "Keine", select: "Auswählen", actions: "Aktionen",
    status: "Status", name: "Name", description: "Beschreibung", type: "Typ",
    date: "Datum", size: "Größe", enabled: "Aktiviert", disabled: "Deaktiviert",
    active: "Aktiv", inactive: "Inaktiv", online: "Online", offline: "Offline",
    unknown: "Unbekannt", total: "Gesamt", used: "Verwendet", free: "Frei",
    available: "Verfügbar", memShort: "Mem", memory: "Speicher", details: "Details",
    configuration: "Konfiguration", confirmDelete: "Löschen bestätigen",
    deleteConfirmation: "Sind Sie sicher, dass Sie dieses Element löschen möchten?",
    noData: "Keine Daten", noResults: "Keine Ergebnisse",
    notAvailable: "Nicht verfügbar", copy: "Kopieren", copied: "Kopiert!",
    download: "Herunterladen", upload: "Hochladen", export: "Exportieren",
    import: "Importieren", filter: "Filtern", sort: "Sortieren",
    reset: "Zurücksetzen", apply: "Anwenden", create: "Erstellen",
    update: "Aktualisieren", view: "Anzeigen", more: "Mehr", less: "Weniger",
    showMore: "Mehr anzeigen", showLess: "Weniger anzeigen",
    expandAll: "Alle erweitern", collapseAll: "Alle einklappen",
    optional: "optional", show: "Anzeigen", hide: "Ausblenden", color: "Farbe",
    comingSoon: "Demnächst", loadVms: "VMs laden", default: "Standard",
    node: "Knoten", darkMode: "Dunkelmodus", lightMode: "Hellmodus",
    healthy: "Gesund", unhealthy: "Ungesund",
    updateAvailable: "Update verfügbar", logout: "Abmelden"
  },
  auth: {
    welcomeTitle: "Willkommen bei CFCenter",
    loginSubtitle: "Melden Sie sich an, um auf Ihre Infrastruktur zuzugreifen",
    loginMethod: "Anmeldemethode", localAccount: "Lokales Konto",
    ldapAd: "LDAP / Active Directory", username: "Benutzername", password: "Passwort",
    rememberMe: "Angemeldet bleiben", forgotPassword: "Passwort vergessen?",
    loggingIn: "Anmeldung...", login: "Anmelden", logout: "Abmelden",
    loggingOut: "Abmeldung...", loginError: "Anmeldefehler",
    notAuthenticated: "Nicht authentifiziert", notAuthorized: "Nicht autorisiert",
    sessionExpired: "Sitzung abgelaufen", invalidCredentials: "Ungültige Anmeldedaten",
    appSubtitle: "Zentralisierte Proxmox-Verwaltung",
    usernamePlaceholder: "benutzer oder user@domain.com"
  },
  navigation: {
    dashboard: "Dashboard", infrastructure: "Infrastruktur", inventory: "Inventar",
    storage: "Speicher", ceph: "Ceph", backups: "Sicherungen",
    resources: "Ressourcen", orchestration: "Orchestrierung", drs: "DRS",
    siteRecovery: "Standortwiederherstellung", networkSecurity: "Netzwerksicherheit",
    operations: "Betrieb", events: "Ereignisse", alerts: "Warnungen",
    jobs: "Aufgabenzentrum", monitoring: "Überwachung",
    securityAccess: "Sicherheit & Zugriff", users: "Benutzer",
    rbacRoles: "RBAC / Rollen", auditLogs: "Audit & Protokolle",
    settings: "Einstellungen", license: "Lizenz", about: "Über",
    templates: "Vorlagen", reports: "Berichte", topology: "Topologie",
    profile: "Profil"
  },
  navbar: {
    language: "Sprache", theme: "Design", aiAssistant: "KI-Assistent",
    notifications: "Benachrichtigungen", profile: "Profil", search: "Suchen",
    searchPlaceholder: "Suchen… (Cluster, Knoten, VMs)",
    searchTip: "Tipp: Strg/Cmd + K zum Öffnen, ESC zum Schließen."
  },
  time: {
    justNow: "gerade eben", secondsAgo: "vor einigen Sekunden",
    minutesAgo: "vor {count} Min.", hoursAgo: "vor {count} Std.",
    daysAgo: "vor {count} T.", synced: "Synchronisiert {time}"
  },
  errors: {
    serverError: "Serverfehler", loadingError: "Ladefehler",
    updateError: "Aktualisierungsfehler", connectionError: "Verbindungsfehler",
    notFound: "Nicht gefunden", pageNotFound: "Seite nicht gefunden",
    httpError: "Fehler {status}"
  },
  errorPages: {
    "404": { title: "Seite nicht gefunden", description: "Die gesuchte Seite existiert nicht oder wurde verschoben." },
    "500": { title: "Serverfehler", description: "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut." },
    "403": { title: "Zugriff verweigert", description: "Sie haben nicht die erforderlichen Berechtigungen." },
    "401": { title: "Nicht authentifiziert", description: "Sie müssen angemeldet sein, um auf diese Seite zuzugreifen." },
    "503": { title: "Dienst nicht verfügbar", description: "Der Dienst ist vorübergehend nicht verfügbar." },
    backToHome: "Zurück zur Startseite", retry: "Wiederholen",
    criticalError: "Kritischer Fehler", errorOccurred: "Ein Fehler ist aufgetreten",
    metaTitle: "404 - Seite nicht gefunden | CFCenter"
  },
  setup: {
    title: "Ersteinrichtung",
    subtitle: "Erstellen Sie Ihr Administratorkonto",
    passwordMismatch: "Passwörter stimmen nicht überein",
    passwordMinLength: "Passwort muss mindestens 8 Zeichen lang sein",
    nameLabel: "Name (optional)", emailLabel: "E-Mail",
    passwordLabel: "Passwort", confirmPasswordLabel: "Passwort bestätigen",
    createAccount: "Administratorkonto erstellen", creating: "Erstellen..."
  },
  vmActions: {
    start: "Starten", stop: "Stoppen", shutdown: "Herunterfahren (ACPI)",
    forceStop: "Erzwungenes Stoppen", pause: "Pausieren", resume: "Fortsetzen",
    restart: "Neustarten", console: "Konsole", migrate: "Migrieren",
    clone: "Klonen", details: "Details"
  },
  settings: {
    title: "Einstellungen", connections: "Verbindungen",
    addConnection: "Verbindung hinzufügen", saveChanges: "Änderungen speichern",
    appearance: "Darstellung", notifications: "Benachrichtigungen",
    security: "Sicherheit", license: "Lizenz"
  },
  dashboard: {
    title: "Dashboard", loadingError: "Fehler beim Laden des Dashboards"
  },
  alerts: {
    title: "Warnungen", noActiveAlerts: "Keine aktiven Warnungen",
    allSystemsNormal: "Alle Systeme arbeiten normal"
  },
  inventory: {
    title: "Inventar", vms: "Virtuelle Maschinen", containers: "Container",
    nodes: "Knoten", clusters: "Cluster"
  },
  storage: { title: "Speicher", overview: "Übersicht" },
  backups: { title: "Sicherungen", subtitle: "PBS-Sicherungsverwaltung" },
  drs: { title: "DRS", subtitle: "Verteilter Ressourcenplaner" },
  events: { title: "Ereignisse", recent: "Aktuelle Ereignisse", all: "Alle Ereignisse" },
  jobs: { title: "Aufgabenzentrum", running: "Laufend", completed: "Abgeschlossen", failed: "Fehlgeschlagen", pending: "Ausstehend", scheduled: "Geplant" },
  console: { title: "Konsole", fullscreen: "Vollbild", connecting: "Verbindung zur Konsole...", reconnect: "Neu verbinden", connected: "Verbunden" },
  about: { title: "Über", description: "Multi-Cluster Proxmox-Verwaltungsplattform", currentVersion: "Aktuelle Version", latestVersion: "Neueste Version", updateAvailable: "Update verfügbar", upToDate: "Aktuell", changelog: "Versionshistorie", copyright: "Alle Rechte vorbehalten." },
  commandPalette: { placeholder: "Seiten, VMs, Knoten, PBS suchen...", pages: "Seiten", virtualMachines: "Virtuelle Maschinen", nodes: "PVE-Knoten", noResults: "Keine Ergebnisse", navigate: "navigieren", select: "auswählen", close: "schließen" },
  emptyState: { noEvents: "Keine Ereignisse", noAlerts: "Keine Warnungen", noJobs: "Keine Aufgaben", noBackups: "Keine Sicherungen", noUsers: "Keine Benutzer", noConnections: "Keine Verbindungen" },
  topology: { title: "Infrastruktur-Topologie", allConnections: "Alle Verbindungen", fitView: "Ansicht anpassen", noData: "Keine Topologiedaten" },
  reports: { title: "Berichte", description: "PDF-Berichte erstellen und planen", generate: "Generieren", history: "Verlauf" },
  ai: { title: "KI-Assistent", thinking: "Denke nach...", clearConversation: "Gespräch löschen", welcomeTitle: "Hallo! 👋", askQuestion: "Stellen Sie Ihre Frage..." },
  siteRecovery: { title: "Standortwiederherstellung", subtitle: "Ceph RBD Cluster-übergreifende Replikation & Disaster Recovery" },
  resources: { infrastructureHealth: "Infrastruktur-Gesundheit", efficiency: "Effizienz", capacityForecasts: "Kapazitätsprognosen", recommendations: "Empfehlungen", environmentalImpact: "Umweltauswirkungen / CSR" },
  monitoring: { title: "Überwachung", cpu: "CPU", memory: "Speicher", disk: "Festplatte", network: "Netzwerk", iops: "IOPS" },
  security: { title: "Sicherheit", users: "Benutzer", rbac: "RBAC / Rollen", audit: "Audit & Protokolle" },
  audit: { title: "Audit & Protokolle", today: "Heute", totalEvents: "Gesamtereignisse" },
  profile: { title: "Profil", updated: "Profil erfolgreich aktualisiert", personalInfo: "Persönliche Informationen", changePassword: "Passwort ändern" },
  user: { defaultName: "Benutzer", admin: "Administrator", operator: "Operator", viewer: "Betrachter" },
  pxcore: { operational: "PXCore betriebsbereit", degraded: "PXCore beeinträchtigt", error: "PXCore-Fehler", offline: "PXCore offline" }
}

// ─── Portuguese (pt) ────────────────────────────────────────────────────────
const pt = {
  common: {
    add: "Adicionar", edit: "Editar", delete: "Excluir", save: "Salvar",
    cancel: "Cancelar", confirm: "Confirmar", close: "Fechar", search: "Pesquisar",
    loading: "Carregando...", saving: "Salvando...", deleting: "Excluindo...",
    error: "Erro", success: "Sucesso", warning: "Aviso", info: "Informação",
    yes: "Sim", no: "Não", ok: "OK", retry: "Tentar novamente",
    refresh: "Atualizar", back: "Voltar", goBack: "Voltar", next: "Próximo",
    previous: "Anterior", all: "Todos", none: "Nenhum", select: "Selecionar",
    actions: "Ações", status: "Status", name: "Nome", description: "Descrição",
    type: "Tipo", date: "Data", size: "Tamanho", enabled: "Ativado",
    disabled: "Desativado", active: "Ativo", inactive: "Inativo",
    online: "Online", offline: "Offline", unknown: "Desconhecido",
    total: "Total", used: "Usado", free: "Livre", available: "Disponível",
    memShort: "Mem", memory: "Memória", details: "Detalhes",
    configuration: "Configuração", confirmDelete: "Confirmar exclusão",
    deleteConfirmation: "Tem certeza de que deseja excluir este item?",
    noData: "Sem dados", noResults: "Sem resultados",
    notAvailable: "Não disponível", copy: "Copiar", copied: "Copiado!",
    download: "Baixar", upload: "Enviar", export: "Exportar",
    import: "Importar", filter: "Filtrar", sort: "Ordenar",
    reset: "Redefinir", apply: "Aplicar", create: "Criar",
    update: "Atualizar", view: "Ver", more: "Mais", less: "Menos",
    showMore: "Mostrar mais", showLess: "Mostrar menos",
    expandAll: "Expandir tudo", collapseAll: "Recolher tudo",
    optional: "opcional", show: "Mostrar", hide: "Ocultar", color: "Cor",
    comingSoon: "Em breve", loadVms: "Carregar VMs", default: "Padrão",
    node: "Nó", darkMode: "Modo escuro", lightMode: "Modo claro",
    healthy: "Saudável", unhealthy: "Não saudável",
    updateAvailable: "Atualização disponível", logout: "Sair"
  },
  auth: {
    welcomeTitle: "Bem-vindo ao CFCenter",
    loginSubtitle: "Faça login para acessar sua infraestrutura",
    loginMethod: "Método de login", localAccount: "Conta local",
    username: "Usuário", password: "Senha", rememberMe: "Lembrar-me",
    loggingIn: "Entrando...", login: "Entrar", logout: "Sair",
    loginError: "Erro de login", invalidCredentials: "Credenciais inválidas",
    appSubtitle: "Gerenciamento centralizado de Proxmox"
  },
  navigation: {
    dashboard: "Painel", infrastructure: "Infraestrutura", inventory: "Inventário",
    storage: "Armazenamento", backups: "Backups", resources: "Recursos",
    operations: "Operações", events: "Eventos", alerts: "Alertas",
    jobs: "Central de tarefas", settings: "Configurações", about: "Sobre",
    reports: "Relatórios", topology: "Topologia", profile: "Perfil",
    users: "Usuários", templates: "Modelos"
  },
  errors: {
    serverError: "Erro do servidor", loadingError: "Erro ao carregar",
    connectionError: "Erro de conexão", notFound: "Não encontrado",
    pageNotFound: "Página não encontrada", httpError: "Erro {status}"
  },
  errorPages: {
    "404": { title: "Página não encontrada", description: "A página que você procura não existe ou foi movida." },
    "500": { title: "Erro do servidor", description: "Ocorreu um erro inesperado. Tente novamente mais tarde." },
    backToHome: "Voltar ao início", retry: "Tentar novamente",
    metaTitle: "404 - Página não encontrada | CFCenter"
  },
  setup: {
    title: "Configuração inicial", subtitle: "Crie sua conta de administrador",
    passwordMismatch: "As senhas não coincidem",
    emailLabel: "Email", passwordLabel: "Senha",
    createAccount: "Criar conta de administrador", creating: "Criando..."
  },
  vmActions: {
    start: "Iniciar", stop: "Parar", shutdown: "Desligar (ACPI)",
    restart: "Reiniciar", console: "Console", migrate: "Migrar", clone: "Clonar"
  },
  dashboard: { title: "Painel" },
  alerts: { title: "Alertas", noActiveAlerts: "Sem alertas ativos" },
  settings: { title: "Configurações", connections: "Conexões" },
  inventory: { title: "Inventário", vms: "Máquinas virtuais", containers: "Contêineres", nodes: "Nós" },
  storage: { title: "Armazenamento", overview: "Visão geral" },
  backups: { title: "Backups" },
  events: { title: "Eventos" },
  jobs: { title: "Central de tarefas", running: "Em execução", completed: "Concluído", failed: "Falhou" },
  about: { title: "Sobre", description: "Plataforma de gerenciamento multi-cluster Proxmox", currentVersion: "Versão atual", upToDate: "Atualizado", copyright: "Todos os direitos reservados." },
  monitoring: { title: "Monitoramento", cpu: "CPU", memory: "Memória", disk: "Disco", network: "Rede" },
  security: { title: "Segurança", users: "Usuários" },
  emptyState: { noEvents: "Sem eventos", noAlerts: "Sem alertas", noBackups: "Sem backups" },
  time: { justNow: "agora mesmo", minutesAgo: "há {count} min", hoursAgo: "há {count}h", daysAgo: "há {count}d" }
}

// ─── Italian (it) ───────────────────────────────────────────────────────────
const it = {
  common: {
    add: "Aggiungi", edit: "Modifica", delete: "Elimina", save: "Salva",
    cancel: "Annulla", confirm: "Conferma", close: "Chiudi", search: "Cerca",
    loading: "Caricamento...", saving: "Salvataggio...", deleting: "Eliminazione...",
    error: "Errore", success: "Successo", warning: "Avviso", info: "Informazione",
    yes: "Sì", no: "No", ok: "OK", retry: "Riprova", refresh: "Aggiorna",
    back: "Indietro", goBack: "Torna indietro", next: "Avanti", previous: "Precedente",
    all: "Tutti", none: "Nessuno", select: "Seleziona", actions: "Azioni",
    status: "Stato", name: "Nome", description: "Descrizione", type: "Tipo",
    date: "Data", size: "Dimensione", enabled: "Abilitato", disabled: "Disabilitato",
    active: "Attivo", inactive: "Inattivo", online: "Online", offline: "Offline",
    unknown: "Sconosciuto", total: "Totale", used: "Usato", free: "Libero",
    available: "Disponibile", memShort: "Mem", memory: "Memoria", details: "Dettagli",
    configuration: "Configurazione", confirmDelete: "Conferma eliminazione",
    deleteConfirmation: "Sei sicuro di voler eliminare questo elemento?",
    noData: "Nessun dato", noResults: "Nessun risultato",
    notAvailable: "Non disponibile", copy: "Copia", copied: "Copiato!",
    download: "Scarica", upload: "Carica", export: "Esporta", import: "Importa",
    filter: "Filtra", sort: "Ordina", reset: "Ripristina", apply: "Applica",
    create: "Crea", update: "Aggiorna", view: "Visualizza", more: "Altro",
    less: "Meno", showMore: "Mostra di più", showLess: "Mostra meno",
    expandAll: "Espandi tutto", collapseAll: "Comprimi tutto",
    optional: "opzionale", show: "Mostra", hide: "Nascondi", color: "Colore",
    comingSoon: "Prossimamente", loadVms: "Carica VM", default: "Predefinito",
    node: "Nodo", darkMode: "Modalità scura", lightMode: "Modalità chiara",
    healthy: "Sano", unhealthy: "Non sano",
    updateAvailable: "Aggiornamento disponibile", logout: "Esci"
  },
  auth: {
    welcomeTitle: "Benvenuto in CFCenter",
    loginSubtitle: "Accedi per gestire la tua infrastruttura",
    loginMethod: "Metodo di accesso", localAccount: "Account locale",
    username: "Nome utente", password: "Password", rememberMe: "Ricordami",
    loggingIn: "Accesso in corso...", login: "Accedi", logout: "Esci",
    loginError: "Errore di accesso", invalidCredentials: "Credenziali non valide",
    appSubtitle: "Gestione centralizzata di Proxmox"
  },
  navigation: {
    dashboard: "Dashboard", infrastructure: "Infrastruttura", inventory: "Inventario",
    storage: "Archiviazione", backups: "Backup", resources: "Risorse",
    operations: "Operazioni", events: "Eventi", alerts: "Avvisi",
    jobs: "Centro attività", settings: "Impostazioni", about: "Informazioni",
    reports: "Report", topology: "Topologia", profile: "Profilo",
    users: "Utenti", templates: "Modelli"
  },
  errors: {
    serverError: "Errore del server", loadingError: "Errore di caricamento",
    connectionError: "Errore di connessione", notFound: "Non trovato",
    pageNotFound: "Pagina non trovata", httpError: "Errore {status}"
  },
  errorPages: {
    "404": { title: "Pagina non trovata", description: "La pagina cercata non esiste o è stata spostata." },
    "500": { title: "Errore del server", description: "Si è verificato un errore imprevisto. Riprova più tardi." },
    backToHome: "Torna alla home", retry: "Riprova",
    metaTitle: "404 - Pagina non trovata | CFCenter"
  },
  setup: {
    title: "Configurazione iniziale", subtitle: "Crea il tuo account amministratore",
    passwordMismatch: "Le password non corrispondono",
    emailLabel: "Email", passwordLabel: "Password",
    createAccount: "Crea account amministratore", creating: "Creazione..."
  },
  vmActions: {
    start: "Avvia", stop: "Ferma", shutdown: "Spegni (ACPI)",
    restart: "Riavvia", console: "Console", migrate: "Migra", clone: "Clona"
  },
  dashboard: { title: "Dashboard" },
  alerts: { title: "Avvisi", noActiveAlerts: "Nessun avviso attivo" },
  settings: { title: "Impostazioni", connections: "Connessioni" },
  inventory: { title: "Inventario", vms: "Macchine virtuali", containers: "Container", nodes: "Nodi" },
  storage: { title: "Archiviazione", overview: "Panoramica" },
  backups: { title: "Backup" },
  events: { title: "Eventi" },
  jobs: { title: "Centro attività", running: "In esecuzione", completed: "Completato", failed: "Fallito" },
  about: { title: "Informazioni", description: "Piattaforma di gestione multi-cluster Proxmox", currentVersion: "Versione attuale", upToDate: "Aggiornato", copyright: "Tutti i diritti riservati." },
  monitoring: { title: "Monitoraggio", cpu: "CPU", memory: "Memoria", disk: "Disco", network: "Rete" },
  security: { title: "Sicurezza", users: "Utenti" },
  emptyState: { noEvents: "Nessun evento", noAlerts: "Nessun avviso", noBackups: "Nessun backup" },
  time: { justNow: "proprio ora", minutesAgo: "{count} min fa", hoursAgo: "{count}h fa", daysAgo: "{count}g fa" }
}

// ─── Japanese (ja) ──────────────────────────────────────────────────────────
const ja = {
  common: {
    add: "追加", edit: "編集", delete: "削除", save: "保存", cancel: "キャンセル",
    confirm: "確認", close: "閉じる", search: "検索", loading: "読み込み中...",
    saving: "保存中...", deleting: "削除中...", error: "エラー", success: "成功",
    warning: "警告", info: "情報", yes: "はい", no: "いいえ", ok: "OK",
    retry: "再試行", refresh: "更新", back: "戻る", goBack: "戻る",
    next: "次へ", previous: "前へ", all: "すべて", none: "なし",
    select: "選択", actions: "アクション", status: "ステータス", name: "名前",
    description: "説明", type: "タイプ", date: "日付", size: "サイズ",
    enabled: "有効", disabled: "無効", active: "アクティブ", inactive: "非アクティブ",
    online: "オンライン", offline: "オフライン", unknown: "不明",
    total: "合計", used: "使用済み", free: "空き", available: "利用可能",
    memShort: "メモリ", memory: "メモリ", details: "詳細", configuration: "設定",
    confirmDelete: "削除の確認",
    deleteConfirmation: "このアイテムを削除してもよろしいですか？",
    noData: "データなし", noResults: "結果なし", notAvailable: "利用不可",
    copy: "コピー", copied: "コピーしました！", download: "ダウンロード",
    upload: "アップロード", export: "エクスポート", import: "インポート",
    filter: "フィルター", sort: "並べ替え", reset: "リセット", apply: "適用",
    create: "作成", update: "更新", view: "表示", more: "もっと見る",
    less: "少なく", showMore: "もっと表示", showLess: "少なく表示",
    expandAll: "すべて展開", collapseAll: "すべて折りたたむ",
    optional: "任意", show: "表示", hide: "非表示", color: "色",
    comingSoon: "近日公開", loadVms: "VM読み込み", default: "デフォルト",
    node: "ノード", darkMode: "ダークモード", lightMode: "ライトモード",
    healthy: "正常", unhealthy: "異常",
    updateAvailable: "アップデートあり", logout: "ログアウト"
  },
  auth: {
    welcomeTitle: "CFCenterへようこそ",
    loginSubtitle: "インフラストラクチャにアクセスするにはログインしてください",
    loginMethod: "ログイン方法", localAccount: "ローカルアカウント",
    username: "ユーザー名", password: "パスワード", rememberMe: "ログイン状態を保持",
    loggingIn: "ログイン中...", login: "ログイン", logout: "ログアウト",
    loginError: "ログインエラー", invalidCredentials: "無効な認証情報",
    appSubtitle: "Proxmox一元管理"
  },
  navigation: {
    dashboard: "ダッシュボード", infrastructure: "インフラストラクチャ",
    inventory: "インベントリ", storage: "ストレージ", backups: "バックアップ",
    resources: "リソース", operations: "運用", events: "イベント",
    alerts: "アラート", jobs: "タスクセンター", settings: "設定",
    about: "バージョン情報", reports: "レポート", topology: "トポロジー",
    profile: "プロフィール", users: "ユーザー", templates: "テンプレート"
  },
  errors: {
    serverError: "サーバーエラー", loadingError: "読み込みエラー",
    connectionError: "接続エラー", notFound: "見つかりません",
    pageNotFound: "ページが見つかりません", httpError: "エラー {status}"
  },
  errorPages: {
    "404": { title: "ページが見つかりません", description: "お探しのページは存在しないか、移動されました。" },
    "500": { title: "サーバーエラー", description: "予期しないエラーが発生しました。後でもう一度お試しください。" },
    backToHome: "ホームに戻る", retry: "再試行",
    metaTitle: "404 - ページが見つかりません | CFCenter"
  },
  setup: {
    title: "初期設定", subtitle: "管理者アカウントを作成してください",
    passwordMismatch: "パスワードが一致しません",
    emailLabel: "メール", passwordLabel: "パスワード",
    createAccount: "管理者アカウントを作成", creating: "作成中..."
  },
  vmActions: {
    start: "起動", stop: "停止", shutdown: "シャットダウン (ACPI)",
    restart: "再起動", console: "コンソール", migrate: "マイグレーション", clone: "クローン"
  },
  dashboard: { title: "ダッシュボード" },
  alerts: { title: "アラート", noActiveAlerts: "アクティブなアラートなし" },
  settings: { title: "設定", connections: "接続" },
  inventory: { title: "インベントリ", vms: "仮想マシン", containers: "コンテナ", nodes: "ノード" },
  storage: { title: "ストレージ", overview: "概要" },
  backups: { title: "バックアップ" },
  events: { title: "イベント" },
  jobs: { title: "タスクセンター", running: "実行中", completed: "完了", failed: "失敗" },
  about: { title: "バージョン情報", description: "マルチクラスターProxmox管理プラットフォーム", currentVersion: "現在のバージョン", upToDate: "最新", copyright: "All rights reserved." },
  monitoring: { title: "モニタリング", cpu: "CPU", memory: "メモリ", disk: "ディスク", network: "ネットワーク" },
  security: { title: "セキュリティ", users: "ユーザー" },
  emptyState: { noEvents: "イベントなし", noAlerts: "アラートなし", noBackups: "バックアップなし" },
  time: { justNow: "たった今", minutesAgo: "{count}分前", hoursAgo: "{count}時間前", daysAgo: "{count}日前" }
}

// ─── Chinese Simplified (zh) ────────────────────────────────────────────────
const zh = {
  common: {
    add: "添加", edit: "编辑", delete: "删除", save: "保存", cancel: "取消",
    confirm: "确认", close: "关闭", search: "搜索", loading: "加载中...",
    saving: "保存中...", deleting: "删除中...", error: "错误", success: "成功",
    warning: "警告", info: "信息", yes: "是", no: "否", ok: "确定",
    retry: "重试", refresh: "刷新", back: "返回", goBack: "返回",
    next: "下一步", previous: "上一步", all: "全部", none: "无",
    select: "选择", actions: "操作", status: "状态", name: "名称",
    description: "描述", type: "类型", date: "日期", size: "大小",
    enabled: "已启用", disabled: "已禁用", active: "活跃", inactive: "不活跃",
    online: "在线", offline: "离线", unknown: "未知",
    total: "总计", used: "已用", free: "空闲", available: "可用",
    memShort: "内存", memory: "内存", details: "详情", configuration: "配置",
    confirmDelete: "确认删除",
    deleteConfirmation: "您确定要删除此项目吗？",
    noData: "暂无数据", noResults: "无结果", notAvailable: "不可用",
    copy: "复制", copied: "已复制！", download: "下载", upload: "上传",
    export: "导出", import: "导入", filter: "筛选", sort: "排序",
    reset: "重置", apply: "应用", create: "创建", update: "更新",
    view: "查看", more: "更多", less: "收起", showMore: "显示更多",
    showLess: "显示更少", expandAll: "全部展开", collapseAll: "全部折叠",
    optional: "可选", show: "显示", hide: "隐藏", color: "颜色",
    comingSoon: "即将推出", loadVms: "加载虚拟机", default: "默认",
    node: "节点", darkMode: "深色模式", lightMode: "浅色模式",
    healthy: "健康", unhealthy: "不健康",
    updateAvailable: "有可用更新", logout: "退出登录"
  },
  auth: {
    welcomeTitle: "欢迎使用 CFCenter",
    loginSubtitle: "登录以访问您的基础设施",
    loginMethod: "登录方式", localAccount: "本地账户",
    username: "用户名", password: "密码", rememberMe: "记住我",
    loggingIn: "登录中...", login: "登录", logout: "退出登录",
    loginError: "登录错误", invalidCredentials: "凭据无效",
    appSubtitle: "Proxmox 集中管理"
  },
  navigation: {
    dashboard: "仪表盘", infrastructure: "基础设施", inventory: "资产清单",
    storage: "存储", backups: "备份", resources: "资源",
    operations: "运维", events: "事件", alerts: "告警",
    jobs: "任务中心", settings: "设置", about: "关于",
    reports: "报告", topology: "拓扑", profile: "个人资料",
    users: "用户", templates: "模板"
  },
  errors: {
    serverError: "服务器错误", loadingError: "加载错误",
    connectionError: "连接错误", notFound: "未找到",
    pageNotFound: "页面未找到", httpError: "错误 {status}"
  },
  errorPages: {
    "404": { title: "页面未找到", description: "您查找的页面不存在或已被移动。" },
    "500": { title: "服务器错误", description: "发生了意外错误，请稍后重试。" },
    backToHome: "返回首页", retry: "重试",
    metaTitle: "404 - 页面未找到 | CFCenter"
  },
  setup: {
    title: "初始设置", subtitle: "创建您的管理员账户",
    passwordMismatch: "密码不匹配",
    emailLabel: "邮箱", passwordLabel: "密码",
    createAccount: "创建管理员账户", creating: "创建中..."
  },
  vmActions: {
    start: "启动", stop: "停止", shutdown: "关机 (ACPI)",
    restart: "重启", console: "控制台", migrate: "迁移", clone: "克隆"
  },
  dashboard: { title: "仪表盘" },
  alerts: { title: "告警", noActiveAlerts: "无活跃告警" },
  settings: { title: "设置", connections: "连接" },
  inventory: { title: "资产清单", vms: "虚拟机", containers: "容器", nodes: "节点" },
  storage: { title: "存储", overview: "概览" },
  backups: { title: "备份" },
  events: { title: "事件" },
  jobs: { title: "任务中心", running: "运行中", completed: "已完成", failed: "失败" },
  about: { title: "关于", description: "多集群 Proxmox 管理平台", currentVersion: "当前版本", upToDate: "已是最新", copyright: "保留所有权利。" },
  monitoring: { title: "监控", cpu: "CPU", memory: "内存", disk: "磁盘", network: "网络" },
  security: { title: "安全", users: "用户" },
  emptyState: { noEvents: "无事件", noAlerts: "无告警", noBackups: "无备份" },
  time: { justNow: "刚刚", minutesAgo: "{count}分钟前", hoursAgo: "{count}小时前", daysAgo: "{count}天前" }
}

// ─── Generate files ─────────────────────────────────────────────────────────
const languages = [
  { code: 'es', overrides: es },
  { code: 'de', overrides: de },
  { code: 'pt', overrides: pt },
  { code: 'it', overrides: it },
  { code: 'ja', overrides: ja },
  { code: 'zh', overrides: zh }
]

for (const { code, overrides } of languages) {
  // Start with English as base, apply translated overrides
  const merged = deepMerge(en, overrides)
  const filePath = path.join(messagesDir, `${code}.json`)
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf8')
  console.log(`✓ Generated ${code}.json (${Object.keys(merged).length} top-level keys)`)
}

// Also generate rolling-updates files
const ruEn = JSON.parse(fs.readFileSync(path.join(messagesDir, 'rolling-updates-en.json'), 'utf8'))

const ruOverrides = {
  es: { updates: { rollingUpdate: "Actualización progresiva", refresh: "Actualizar", nodesStatus: "Estado de nodos", node: "Nodo", version: "Versión", vms: "VMs", availableUpdates: "Actualizaciones disponibles", status: "Estado", online: "En línea", offline: "Fuera de línea", upToDate: "Todos los nodos están actualizados", close: "Cerrar", startRollingUpdate: "Iniciar actualización progresiva" } },
  de: { updates: { rollingUpdate: "Rolling Update", refresh: "Aktualisieren", nodesStatus: "Knotenstatus", node: "Knoten", version: "Version", vms: "VMs", availableUpdates: "Verfügbare Updates", status: "Status", online: "Online", offline: "Offline", upToDate: "Alle Knoten sind aktuell", close: "Schließen", startRollingUpdate: "Rolling Update starten" } },
  pt: { updates: { rollingUpdate: "Atualização progressiva", refresh: "Atualizar", nodesStatus: "Status dos nós", node: "Nó", version: "Versão", vms: "VMs", availableUpdates: "Atualizações disponíveis", status: "Status", online: "Online", offline: "Offline", upToDate: "Todos os nós estão atualizados", close: "Fechar", startRollingUpdate: "Iniciar atualização progressiva" } },
  it: { updates: { rollingUpdate: "Aggiornamento progressivo", refresh: "Aggiorna", nodesStatus: "Stato dei nodi", node: "Nodo", version: "Versione", vms: "VM", availableUpdates: "Aggiornamenti disponibili", status: "Stato", online: "Online", offline: "Offline", upToDate: "Tutti i nodi sono aggiornati", close: "Chiudi", startRollingUpdate: "Avvia aggiornamento progressivo" } },
  ja: { updates: { rollingUpdate: "ローリングアップデート", refresh: "更新", nodesStatus: "ノードステータス", node: "ノード", version: "バージョン", vms: "VM", availableUpdates: "利用可能なアップデート", status: "ステータス", online: "オンライン", offline: "オフライン", upToDate: "すべてのノードは最新です", close: "閉じる", startRollingUpdate: "ローリングアップデートを開始" } },
  zh: { updates: { rollingUpdate: "滚动更新", refresh: "刷新", nodesStatus: "节点状态", node: "节点", version: "版本", vms: "虚拟机", availableUpdates: "可用更新", status: "状态", online: "在线", offline: "离线", upToDate: "所有节点已是最新", close: "关闭", startRollingUpdate: "开始滚动更新" } }
}

for (const code of Object.keys(ruOverrides)) {
  const merged = deepMerge(ruEn, ruOverrides[code])
  const filePath = path.join(messagesDir, `rolling-updates-${code}.json`)
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf8')
  console.log(`✓ Generated rolling-updates-${code}.json`)
}

console.log('\nDone! All translation files generated.')
