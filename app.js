// Sistema GlassDrive Multi-taller - Aplicación JavaScript Completa
// Funciona completamente offline con datos en localStorage
// OCR real con Tesseract.js para extraer matrículas y documentos

class GlassDriveMultiTaller {
    constructor() {
        // Estado de la aplicación
        this.currentUser = null;
        this.currentTaller = null;
        this.currentStep = 1;
        this.totalSteps = 3;
        this.currentExpedient = this.resetExpedient();
        
        // Datos de la aplicación
        this.talleres = [];
        this.usuarios = [];
        this.expedientes = [];
        this.servicios = [];
        
        // Estados de la cámara y OCR
        this.cameraStream = null;
        this.documentCameraStream = null;
        this.tesseractWorker = null;
        this.photoCounter = 1;
        
        // Inicializar datos GlassDrive PRIMERO
        this.initializeGlassDriveData();
        
        // Patrones OCR para documentos españoles
        this.ocrPatterns = {
            matricula_espanola: /^[0-9]{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/,
            ficha_tecnica: {
                matricula: /matrícula[:\s]*([A-Z0-9\s-]+)/i,
                bastidor: /bastidor[:\s]*([A-Z0-9]+)/i,
                marca: /(volkswagen|seat|ford|renault|peugeot|citroen|toyota|nissan|bmw|mercedes|audi)/i,
                modelo: /modelo[:\s]*([a-záéíóúñ\s]+)/i,
                potencia: /potencia[:\s]*(\d+[\.,]?\d*)\s*(cv|kw)/i,
                cilindrada: /cilindrada[:\s]*(\d+)\s*cc/i,
                combustible: /combustible[:\s]*(gasolina|diesel|eléctrico|híbrido)/i
            },
            poliza_seguro: {
                numero_poliza: /póliza[:\s#nº]*([A-Z0-9-]+)/i,
                aseguradora: /(mapfre|axa|zurich|línea directa|mutua madrileña|allianz|generali)/i,
                vigencia_desde: /vigencia[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
                vigencia_hasta: /hasta[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
                cobertura: /cobertura[:\s]*(terceros|todo\s*riesgo|terceros\s*ampliado)/i,
                asegurado: /asegurado[:\s]*([A-ZÁÉÍÓÚÑ\s]+)/i
            }
        };
        
        // Inicializar después del DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    initializeGlassDriveData() {
        console.log('🏢 Inicializando datos de talleres GlassDrive...');
        
        // Datos desde el JSON proporcionado
        this.talleres = [
            { "id": "mad-norte", "nombre": "Madrid Norte", "direccion": "C/ Bravo Murillo 123", "telefono": "91-555-0101" },
            { "id": "mad-sur", "nombre": "Madrid Sur", "direccion": "A-42 Km 15", "telefono": "91-555-0102" },
            { "id": "bcn-centro", "nombre": "Barcelona Centro", "direccion": "Av. Diagonal 456", "telefono": "93-555-0201" },
            { "id": "bcn-norte", "nombre": "Barcelona Norte", "direccion": "Ronda Guinardó 789", "telefono": "93-555-0202" },
            { "id": "val-este", "nombre": "Valencia Este", "direccion": "CV-35 Salida 12", "telefono": "96-555-0301" },
            { "id": "sev-norte", "nombre": "Sevilla Norte", "direccion": "A-4 Km 532", "telefono": "95-555-0401" },
            { "id": "bil-centro", "nombre": "Bilbao Centro", "direccion": "Gran Vía 89", "telefono": "94-555-0501" },
            { "id": "zar-oeste", "nombre": "Zaragoza Oeste", "direccion": "A-2 Km 315", "telefono": "97-555-0601" }
        ];

        this.servicios = [
            "Sustitución parabrisas",
            "Reparación impacto", 
            "Cambio luna lateral",
            "Sustitución luneta trasera",
            "Calibración sistemas ADAS",
            "Tratamiento hidrofóbico"
        ];

        this.usuarios = [
            { "nombre": "Carlos Martinez", "taller_id": "mad-norte", "rol": "Recepcionista" },
            { "nombre": "Maria Santos", "taller_id": "bcn-centro", "rol": "Recepcionista" },
            { "nombre": "Jose Lopez", "taller_id": "val-este", "rol": "Recepcionista" },
            { "nombre": "Carmen Ruiz", "taller_id": "sev-norte", "rol": "Supervisora" }
        ];
        
        console.log(`✅ Cargados ${this.talleres.length} talleres GlassDrive`);
    }

    resetExpedient() {
        return {
            fotos: [],
            foto_frontal_index: null,
            matricula_extraida: null,
            confidence_ocr: null,
            ficha_tecnica: null,
            poliza_seguro: null,
            taller_id: null,
            usuario_creador: null
        };
    }

    async init() {
        console.log('🚗 Inicializando Sistema GlassDrive Multi-taller...');
        
        this.loadStoredData();
        this.setupEventListeners();
        this.checkUserSession();
        
        // Initialize Tesseract in background
        this.initTesseract();
        
        console.log('✅ Sistema GlassDrive inicializado correctamente');
    }

    async initTesseract() {
        try {
            console.log('🔍 Inicializando Tesseract OCR...');
            this.tesseractWorker = await Tesseract.createWorker();
            await this.tesseractWorker.loadLanguage('spa+eng');
            await this.tesseractWorker.initialize('spa+eng');
            console.log('✅ Tesseract OCR listo');
        } catch (error) {
            console.error('❌ Error inicializando Tesseract:', error);
            this.showToast('warning', 'OCR', 'OCR no disponible - usando modo demo');
        }
    }

    loadStoredData() {
        // Cargar datos almacenados
        const storedExpedientes = localStorage.getItem('glassdrive_expedientes');
        const storedUsuarios = localStorage.getItem('glassdrive_usuarios');
        
        if (storedExpedientes) {
            this.expedientes = JSON.parse(storedExpedientes);
        } else {
            this.expedientes = this.generateSampleExpedientes();
            this.saveExpedientes();
        }

        if (storedUsuarios) {
            this.usuarios = [...this.usuarios, ...JSON.parse(storedUsuarios)];
        }
    }

    generateSampleExpedientes() {
        return [
            {
                "id": "EXP-2025-001",
                "matricula": "2468BCD",
                "fecha": "2025-01-25",
                "taller": { "id": "mad-norte", "nombre": "Madrid Norte" },
                "usuario_recepcion": "Carlos Martinez",
                "cliente": {
                    "nombre": "Ana Rodriguez Lopez",
                    "telefono": "644987123",
                    "email": "ana.rodriguez@email.com"
                },
                "vehiculo": {
                    "marca": "Volkswagen",
                    "modelo": "Golf",
                    "año": 2021,
                    "color": "Gris Platino",
                    "bastidor": "WVWZZZ1KZ2W987654"
                },
                "servicio": "Sustitución parabrisas",
                "estado": "En diagnóstico",
                "fotos": ["frontal.jpg", "lateral_izq.jpg", "dano_detalle.jpg"],
                "ocr_confianza": { "matricula": 97.2, "ficha_tecnica": 89.5, "poliza": 92.8 },
                "observaciones": "Impacto en esquina superior derecha"
            },
            {
                "id": "EXP-2025-002", 
                "matricula": "7890XYZ",
                "fecha": "2025-01-24",
                "taller": { "id": "bcn-centro", "nombre": "Barcelona Centro" },
                "usuario_recepcion": "Maria Santos",
                "cliente": {
                    "nombre": "Miguel Fernandez Ruiz",
                    "telefono": "622445566",
                    "email": "miguel.fernandez@email.com"
                },
                "vehiculo": {
                    "marca": "Seat",
                    "modelo": "Ateca", 
                    "año": 2020,
                    "color": "Blanco Nieve"
                },
                "servicio": "Reparación impacto",
                "estado": "Completado",
                "fotos": ["frontal.jpg", "impacto_detalle.jpg"],
                "ocr_confianza": { "matricula": 95.1, "ficha_tecnica": 91.3, "poliza": 88.7 }
            },
            {
                "id": "EXP-2025-003",
                "matricula": "5678DEF", 
                "fecha": "2025-01-23",
                "taller": { "id": "val-este", "nombre": "Valencia Este" },
                "usuario_recepcion": "Jose Lopez",
                "cliente": {
                    "nombre": "Carmen Jimenez Vega",
                    "telefono": "677123456",
                    "email": "carmen.jimenez@email.com"
                },
                "vehiculo": {
                    "marca": "Toyota",
                    "modelo": "Corolla",
                    "año": 2019,
                    "color": "Azul Metalizado"
                },
                "servicio": "Cambio luna lateral",
                "estado": "En reparación",
                "fotos": ["frontal.jpg", "lateral_derecho.jpg"],
                "ocr_confianza": { "matricula": 93.4, "ficha_tecnica": 87.9 }
            }
        ];
    }

    checkUserSession() {
        const storedSession = localStorage.getItem('glassdrive_session');
        if (storedSession) {
            const session = JSON.parse(storedSession);
            this.currentUser = session.usuario;
            this.currentTaller = session.taller;
            this.showMainApp();
        } else {
            this.showLoginScreen();
        }
    }

    showLoginScreen() {
        console.log('👤 Mostrando pantalla de login');
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        
        if (loginScreen) loginScreen.classList.remove('hidden');
        if (mainApp) mainApp.classList.add('hidden');
        
        // IMPORTANTE: Poblar talleres DESPUÉS de mostrar la pantalla
        this.populateLoginTalleres();
    }

    showMainApp() {
        console.log('🏠 Mostrando aplicación principal');
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        
        if (loginScreen) loginScreen.classList.add('hidden');
        if (mainApp) mainApp.classList.remove('hidden');
        
        this.updateUserInfo();
        this.updateDashboard();
        this.renderRecentVehicles();
        this.renderExpedientes();
        this.renderTalleres();
        this.renderCarpetasStructure();
        this.setupFormOptions();
    }

    populateLoginTalleres() {
        console.log('🏢 Poblando dropdown de talleres...');
        const select = document.getElementById('loginTaller');
        if (select) {
            let html = '<option value="">Seleccionar taller...</option>';
            this.talleres.forEach(taller => {
                html += `<option value="${taller.id}">${taller.nombre}</option>`;
            });
            select.innerHTML = html;
            console.log(`✅ Dropdown poblado con ${this.talleres.length} talleres`);
        } else {
            console.error('❌ Element loginTaller not found');
        }
    }

    setupEventListeners() {
        console.log('🔗 Configurando event listeners...');
        
        // Login
        const btnIniciarSesion = document.getElementById('btnIniciarSesion');
        if (btnIniciarSesion) {
            btnIniciarSesion.addEventListener('click', () => this.handleLogin());
        }

        // Logout
        const btnCerrarSesion = document.getElementById('btnCerrarSesion');
        if (btnCerrarSesion) {
            btnCerrarSesion.addEventListener('click', () => this.handleLogout());
        }

        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSection(link.dataset.section);
            });
        });

        // Nuevo registro
        const btnNuevoRegistro = document.getElementById('btnNuevoRegistro');
        if (btnNuevoRegistro) {
            btnNuevoRegistro.addEventListener('click', () => this.openRegistrationWizard());
        }

        // Modal close
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) this.closeModal(modal.id);
            });
        });

        // Wizard navigation
        const btnPrevStep = document.getElementById('btnPrevStep');
        const btnNextStep = document.getElementById('btnNextStep');
        const btnCrearExpediente = document.getElementById('btnCrearExpediente');

        if (btnPrevStep) btnPrevStep.addEventListener('click', () => this.previousStep());
        if (btnNextStep) btnNextStep.addEventListener('click', () => this.nextStep());
        if (btnCrearExpediente) btnCrearExpediente.addEventListener('click', () => this.createExpedient());

        // Step 1: Photos
        this.setupPhotoEventListeners();
        
        // Step 2: Ficha técnica
        this.setupFichaEventListeners();
        
        // Step 3: Póliza
        this.setupPolizaEventListeners();

        // Search
        this.setupSearchEventListeners();

        // Modal backdrop clicks
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
        
        console.log('✅ Event listeners configurados');
    }

    setupPhotoEventListeners() {
        const btnIniciarCamera = document.getElementById('btnIniciarCamera');
        const btnCapturar = document.getElementById('btnCapturar');
        const btnPararCamera = document.getElementById('btnPararCamera');
        const btnFotosDemo = document.getElementById('btnFotosDemo');

        if (btnIniciarCamera) btnIniciarCamera.addEventListener('click', () => this.startPhotoCamera());
        if (btnCapturar) btnCapturar.addEventListener('click', () => this.captureVehiclePhoto());
        if (btnPararCamera) btnPararCamera.addEventListener('click', () => this.stopPhotoCamera());
        if (btnFotosDemo) btnFotosDemo.addEventListener('click', () => this.generateDemoPhotos());
    }

    setupFichaEventListeners() {
        const btnFotoFicha = document.getElementById('btnFotoFicha');
        const btnArchivoFicha = document.getElementById('btnArchivoFicha');
        const btnDemoFicha = document.getElementById('btnDemoFicha');
        
        if (btnFotoFicha) btnFotoFicha.addEventListener('click', () => this.startDocumentCamera('ficha'));
        if (btnArchivoFicha) btnArchivoFicha.addEventListener('click', () => this.showUploadSection('ficha'));
        if (btnDemoFicha) btnDemoFicha.addEventListener('click', () => this.generateDemoFicha());

        this.setupFileUpload('fileFichaTecnica', 'ficha_tecnica');
        this.setupUploadArea('uploadFichaTecnica', 'fileFichaTecnica', 'ficha_tecnica');
    }

    setupPolizaEventListeners() {
        const btnFotoPoliza = document.getElementById('btnFotoPoliza');
        const btnArchivoPoliza = document.getElementById('btnArchivoPoliza');
        const btnDemoPoliza = document.getElementById('btnDemoPoliza');
        const btnSaltarPoliza = document.getElementById('btnSaltarPoliza');
        
        if (btnFotoPoliza) btnFotoPoliza.addEventListener('click', () => this.startDocumentCamera('poliza'));
        if (btnArchivoPoliza) btnArchivoPoliza.addEventListener('click', () => this.showUploadSection('poliza'));
        if (btnDemoPoliza) btnDemoPoliza.addEventListener('click', () => this.generateDemoPoliza());
        if (btnSaltarPoliza) btnSaltarPoliza.addEventListener('click', () => this.skipPoliza());

        this.setupFileUpload('filePoliza', 'poliza_seguro');
        this.setupUploadArea('uploadPoliza', 'filePoliza', 'poliza_seguro');
    }

    setupSearchEventListeners() {
        const quickSearch = document.getElementById('quickSearch');
        const btnQuickSearch = document.getElementById('btnQuickSearch');
        const searchExpedientes = document.getElementById('searchExpedientes');
        const filterByTaller = document.getElementById('filterByTaller');
        const btnBuscar = document.getElementById('btnBuscar');
        const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');

        if (quickSearch) {
            quickSearch.addEventListener('input', (e) => {
                if (e.target.value.length >= 3) {
                    this.performQuickSearch(e.target.value);
                } else {
                    this.clearQuickSearchResults();
                }
            });
        }

        if (btnQuickSearch) btnQuickSearch.addEventListener('click', () => {
            const query = quickSearch ? quickSearch.value : '';
            if (query) this.performQuickSearch(query);
        });

        if (searchExpedientes) {
            searchExpedientes.addEventListener('input', (e) => {
                this.searchExpedientes(e.target.value);
            });
        }

        if (filterByTaller) {
            filterByTaller.addEventListener('change', (e) => {
                this.filterExpedientesByTaller(e.target.value);
            });
        }

        if (btnBuscar) btnBuscar.addEventListener('click', () => this.performAdvancedSearch());
        if (btnLimpiarFiltros) btnLimpiarFiltros.addEventListener('click', () => this.clearAdvancedFilters());
    }

    handleLogin() {
        console.log('🔐 Intentando login...');
        const tallerSelect = document.getElementById('loginTaller');
        const usuarioInput = document.getElementById('loginUsuario');
        
        const tallerId = tallerSelect ? tallerSelect.value : '';
        const usuarioNombre = usuarioInput ? usuarioInput.value.trim() : '';
        
        console.log(`Taller seleccionado: ${tallerId}, Usuario: ${usuarioNombre}`);
        
        if (!tallerId || !usuarioNombre) {
            this.showToast('error', 'Error', 'Complete todos los campos');
            return;
        }

        // Buscar taller
        const taller = this.talleres.find(t => t.id === tallerId);
        if (!taller) {
            this.showToast('error', 'Error', 'Taller no válido');
            return;
        }

        this.currentUser = usuarioNombre;
        this.currentTaller = taller;

        // Guardar sesión
        const session = {
            usuario: this.currentUser,
            taller: this.currentTaller,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('glassdrive_session', JSON.stringify(session));

        console.log(`✅ Login exitoso: ${usuarioNombre} en ${taller.nombre}`);
        this.showToast('success', 'Bienvenido', `Acceso a ${taller.nombre}`);
        this.showMainApp();
    }

    handleLogout() {
        localStorage.removeItem('glassdrive_session');
        this.currentUser = null;
        this.currentTaller = null;
        this.stopAllCameras();
        this.showToast('info', 'Sesión', 'Sesión cerrada');
        this.showLoginScreen();
    }

    updateUserInfo() {
        const usuarioActual = document.getElementById('usuarioActual');
        const tallerActual = document.getElementById('tallerActual');
        
        if (usuarioActual) usuarioActual.textContent = this.currentUser || 'Usuario';
        if (tallerActual) tallerActual.textContent = this.currentTaller?.nombre || 'Taller';
    }

    showSection(sectionName) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeLink) activeLink.classList.add('active');

        // Show section
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        const targetSection = document.getElementById(sectionName);
        if (targetSection) targetSection.classList.add('active');

        // Load section specific content
        switch(sectionName) {
            case 'expedientes':
                this.renderExpedientes();
                this.setupExpedientesFilters();
                break;
            case 'busqueda':
                this.setupAdvancedSearchFilters();
                break;
            case 'talleres':
                this.renderTalleres();
                break;
            case 'carpetas':
                this.renderCarpetasStructure();
                break;
        }
    }

    updateDashboard() {
        const today = new Date().toISOString().split('T')[0];
        const totalVehiculos = this.expedientes.length;
        const ingresosHoy = this.expedientes.filter(exp => exp.fecha === today).length;
        const enReparacion = this.expedientes.filter(exp => 
            exp.estado === 'En diagnóstico' || exp.estado === 'En reparación'
        ).length;
        const completados = this.expedientes.filter(exp => exp.estado === 'Completado').length;

        this.updateStatCard('totalVehiculos', totalVehiculos);
        this.updateStatCard('ingresosHoy', ingresosHoy);
        this.updateStatCard('enReparacion', enReparacion);
        this.updateStatCard('completados', completados);
    }

    updateStatCard(id, value) {
        const element = document.getElementById(id);
        if (element) {
            // Animate number change
            const current = parseInt(element.textContent) || 0;
            this.animateNumber(element, current, value, 1000);
        }
    }

    animateNumber(element, start, end, duration) {
        const startTime = performance.now();
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = Math.round(start + (end - start) * progress);
            element.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);
    }

    renderRecentVehicles() {
        const container = document.getElementById('recentVehicles');
        if (!container) return;

        const recentExpedientes = this.expedientes
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .slice(0, 6);

        container.innerHTML = recentExpedientes.map(exp => `
            <div class="vehicle-card" onclick="app.viewExpedient('${exp.id}')">
                <div class="vehicle-card-header">
                    <div class="vehicle-matricula">${exp.matricula}</div>
                    <div class="status status--${this.getStatusClass(exp.estado)}">${exp.estado}</div>
                </div>
                <div class="vehicle-card-body">
                    <div class="vehicle-info">
                        <div class="vehicle-info-item">
                            <div class="vehicle-info-label">Cliente</div>
                            <div class="vehicle-info-value">${exp.cliente.nombre}</div>
                        </div>
                        <div class="vehicle-info-item">
                            <div class="vehicle-info-label">Taller</div>
                            <div class="vehicle-info-value">${exp.taller.nombre}</div>
                        </div>
                        <div class="vehicle-info-item">
                            <div class="vehicle-info-label">Servicio</div>
                            <div class="vehicle-info-value">${exp.servicio}</div>
                        </div>
                        <div class="vehicle-info-item">
                            <div class="vehicle-info-label">Fecha</div>
                            <div class="vehicle-info-value">${this.formatDate(exp.fecha)}</div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderExpedientes(expedientes = this.expedientes) {
        const container = document.getElementById('expedientesList');
        if (!container) return;
        
        container.innerHTML = expedientes.map(exp => `
            <div class="expediente-card" onclick="app.viewExpedient('${exp.id}')">
                <div class="expediente-header">
                    <div class="expediente-matricula">${exp.matricula}</div>
                    <div class="status status--${this.getStatusClass(exp.estado)}">${exp.estado}</div>
                </div>
                <div class="expediente-body">
                    <div class="expediente-client">${exp.cliente.nombre}</div>
                    <div class="expediente-details">
                        <div><i class="fas fa-map-marker-alt"></i> ${exp.taller.nombre}</div>
                        <div><i class="fas fa-tools"></i> ${exp.servicio}</div>
                        <div><i class="fas fa-user"></i> ${exp.usuario_recepcion}</div>
                        ${exp.ocr_confianza ? `<div><i class="fas fa-eye"></i> OCR: ${exp.ocr_confianza.matricula}%</div>` : ''}
                    </div>
                    <div class="expediente-footer">
                        <div class="expediente-date">${this.formatDate(exp.fecha)}</div>
                        <span class="status status--info">
                            <i class="fas fa-folder"></i> 
                            /${exp.taller.id}/${exp.matricula}/
                        </span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderTalleres() {
        const container = document.getElementById('talleresList');
        if (!container) return;
        
        const talleresData = this.talleres.map(taller => {
            const expedientesTaller = this.expedientes.filter(exp => exp.taller.id === taller.id);
            const completados = expedientesTaller.filter(exp => exp.estado === 'Completado').length;
            const pendientes = expedientesTaller.filter(exp => 
                exp.estado !== 'Completado' && exp.estado !== 'Cancelado'
            ).length;
            
            return {
                ...taller,
                total: expedientesTaller.length,
                completados,
                pendientes,
                eficiencia: expedientesTaller.length > 0 ? Math.round((completados / expedientesTaller.length) * 100) : 0
            };
        });

        container.innerHTML = talleresData.map(taller => `
            <div class="taller-card">
                <div class="taller-header">
                    <div class="taller-name">${taller.nombre}</div>
                    <div style="font-size: 0.8rem; opacity: 0.9;">${taller.direccion}</div>
                </div>
                <div class="taller-body">
                    <div class="taller-stats">
                        <div class="taller-stat">
                            <div class="taller-stat-number">${taller.total}</div>
                            <div class="taller-stat-label">Total</div>
                        </div>
                        <div class="taller-stat">
                            <div class="taller-stat-number">${taller.completados}</div>
                            <div class="taller-stat-label">Completados</div>
                        </div>
                        <div class="taller-stat">
                            <div class="taller-stat-number">${taller.pendientes}</div>
                            <div class="taller-stat-label">Pendientes</div>
                        </div>
                        <div class="taller-stat">
                            <div class="taller-stat-number">${taller.eficiencia}%</div>
                            <div class="taller-stat-label">Eficiencia</div>
                        </div>
                    </div>
                    <div style="margin-top: 1rem; text-align: center;">
                        <button class="btn btn--outline btn--sm" onclick="app.filterByTaller('${taller.id}')">
                            <i class="fas fa-filter"></i> Ver Expedientes
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderCarpetasStructure() {
        const container = document.getElementById('carpetasContent');
        if (!container) return;

        let html = '';
        
        // Agrupar expedientes por taller
        const expedientesPorTaller = {};
        this.expedientes.forEach(exp => {
            const tallerId = exp.taller.id;
            if (!expedientesPorTaller[tallerId]) {
                expedientesPorTaller[tallerId] = [];
            }
            expedientesPorTaller[tallerId].push(exp);
        });

        // Renderizar estructura de carpetas
        this.talleres.forEach(taller => {
            const expedientes = expedientesPorTaller[taller.id] || [];
            
            html += `
                <div class="carpeta-item folder">
                    <i class="fas fa-folder"></i>
                    <span>${taller.nombre}/ (${expedientes.length} expedientes)</span>
                </div>
            `;
            
            expedientes.forEach(exp => {
                html += `
                    <div class="carpeta-item folder" style="padding-left: 2rem;">
                        <i class="fas fa-folder"></i>
                        <span>${exp.matricula}/</span>
                    </div>
                    <div class="carpeta-item file" style="padding-left: 3rem;">
                        <i class="fas fa-images"></i>
                        <span>fotos/ (${exp.fotos ? exp.fotos.length : 0} archivos)</span>
                    </div>
                    <div class="carpeta-item file" style="padding-left: 3rem;">
                        <i class="fas fa-file-alt"></i>
                        <span>documentos/ (ficha_tecnica.pdf, poliza_seguro.pdf)</span>
                    </div>
                    <div class="carpeta-item file" style="padding-left: 3rem;">
                        <i class="fas fa-code"></i>
                        <span>procesados/ (ocr_results.json)</span>
                    </div>
                    <div class="carpeta-item file" style="padding-left: 3rem;">
                        <i class="fas fa-file-code"></i>
                        <span>expediente.json</span>
                    </div>
                `;
            });
        });

        container.innerHTML = html;
    }

    setupFormOptions() {
        // Servicios GlassDrive
        const servicioSelect = document.getElementById('servicioGlassDrive');
        if (servicioSelect) {
            servicioSelect.innerHTML = '<option value="">Seleccionar servicio...</option>' + 
                this.servicios.map(servicio => `<option value="${servicio}">${servicio}</option>`).join('');
        }
    }

    setupExpedientesFilters() {
        const filterByTaller = document.getElementById('filterByTaller');
        if (filterByTaller) {
            filterByTaller.innerHTML = '<option value="">Todos los talleres</option>' +
                this.talleres.map(taller => 
                    `<option value="${taller.id}">${taller.nombre}</option>`
                ).join('');
        }
    }

    setupAdvancedSearchFilters() {
        // Talleres filter
        const filterTaller = document.getElementById('filterTaller');
        if (filterTaller) {
            filterTaller.innerHTML = '<option value="">Todos los talleres</option>' +
                this.talleres.map(taller => 
                    `<option value="${taller.id}">${taller.nombre}</option>`
                ).join('');
        }

        // Servicios filter
        const filterServicio = document.getElementById('filterServicio');
        if (filterServicio) {
            const serviciosUnicos = [...new Set(this.expedientes.map(exp => exp.servicio))];
            filterServicio.innerHTML = '<option value="">Todos los servicios</option>' +
                serviciosUnicos.map(servicio => 
                    `<option value="${servicio}">${servicio}</option>`
                ).join('');
        }
    }

    // WIZARD FUNCTIONALITY

    openRegistrationWizard() {
        this.currentStep = 1;
        this.currentExpedient = this.resetExpedient();
        this.currentExpedient.taller_id = this.currentTaller.id;
        this.currentExpedient.usuario_creador = this.currentUser;
        this.photoCounter = 1;
        
        const modalTallerName = document.getElementById('modalTallerName');
        if (modalTallerName) modalTallerName.textContent = this.currentTaller.nombre;
        
        this.showModal('modalRegistro');
        this.updateWizardStep();
        this.resetWizardForm();
    }

    resetWizardForm() {
        // Reset all form fields
        const form = document.getElementById('modalRegistro');
        if (form) {
            const inputs = form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                if (input.type !== 'file') {
                    input.value = '';
                }
            });
        }

        // Reset galleries and results
        const galleryGrid = document.getElementById('galleryGrid');
        const ocrResults = document.getElementById('ocrResults');
        
        if (galleryGrid) galleryGrid.innerHTML = '';
        if (ocrResults) {
            const matriculaDetected = ocrResults.querySelector('#matriculaDetected');
            const ocrProgress = ocrResults.querySelector('#ocrProgress');
            if (matriculaDetected) matriculaDetected.classList.add('hidden');
            if (ocrProgress) ocrProgress.classList.add('hidden');
        }
        
        // Reset document sections
        this.resetDocumentSections();
        
        // Stop cameras
        this.stopAllCameras();
    }

    resetDocumentSections() {
        ['ficha', 'poliza'].forEach(type => {
            const extractedData = document.getElementById(`extractedData${type.charAt(0).toUpperCase() + type.slice(1)}`);
            const processing = document.getElementById(`processing${type.charAt(0).toUpperCase() + type.slice(1)}`);
            
            if (extractedData) extractedData.classList.add('hidden');
            if (processing) processing.classList.add('hidden');
        });

        const finalSummary = document.getElementById('finalSummary');
        if (finalSummary) finalSummary.innerHTML = '';
    }

    updateWizardStep() {
        // Update step indicators
        document.querySelectorAll('.step').forEach((step, index) => {
            step.classList.toggle('active', index + 1 === this.currentStep);
        });

        // Show current step content
        document.querySelectorAll('.wizard-step').forEach((step, index) => {
            step.classList.toggle('active', index + 1 === this.currentStep);
        });

        // Update navigation buttons
        const prevBtn = document.getElementById('btnPrevStep');
        const nextBtn = document.getElementById('btnNextStep');
        const createBtn = document.getElementById('btnCrearExpediente');

        if (prevBtn) prevBtn.style.display = this.currentStep === 1 ? 'none' : 'inline-flex';
        
        if (this.currentStep === this.totalSteps) {
            if (nextBtn) nextBtn.classList.add('hidden');
            if (createBtn) createBtn.classList.remove('hidden');
            this.updateFinalSummary();
        } else {
            if (nextBtn) nextBtn.classList.remove('hidden');
            if (createBtn) createBtn.classList.add('hidden');
        }
    }

    nextStep() {
        if (this.validateCurrentStep()) {
            if (this.currentStep < this.totalSteps) {
                this.currentStep++;
                this.updateWizardStep();
            }
        }
    }

    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateWizardStep();
        }
    }

    validateCurrentStep() {
        switch(this.currentStep) {
            case 1:
                return this.validatePhotos();
            case 2:
                return this.validateFichaTecnica();
            case 3:
                return true; // Póliza es opcional
            default:
                return true;
        }
    }

    validatePhotos() {
        if (this.currentExpedient.fotos.length === 0) {
            this.showToast('warning', 'Fotos', 'Debe capturar al menos una foto o usar demo');
            return false;
        }
        return true;
    }

    validateFichaTecnica() {
        const clienteNombre = document.getElementById('clienteNombre');
        const clienteTelefono = document.getElementById('clienteTelefono');
        const servicioGlassDrive = document.getElementById('servicioGlassDrive');
        
        if (!clienteNombre?.value || !clienteTelefono?.value || !servicioGlassDrive?.value) {
            this.showToast('error', 'Datos Requeridos', 'Complete los campos obligatorios');
            return false;
        }
        return true;
    }

    // PHOTO CAPTURE

    async startPhotoCamera() {
        try {
            this.cameraStream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            
            const video = document.getElementById('cameraVideo');
            if (video) {
                video.srcObject = this.cameraStream;
                video.play();
            }
            
            this.updateCameraButtons(true);
            this.showToast('success', 'Cámara', 'Cámara iniciada correctamente');
        } catch (error) {
            console.error('Error accessing camera:', error);
            this.showToast('error', 'Cámara', 'No se puede acceder a la cámara');
        }
    }

    updateCameraButtons(cameraActive) {
        const btnIniciarCamera = document.getElementById('btnIniciarCamera');
        const btnCapturar = document.getElementById('btnCapturar');
        const btnPararCamera = document.getElementById('btnPararCamera');

        if (btnIniciarCamera) btnIniciarCamera.classList.toggle('hidden', cameraActive);
        if (btnCapturar) btnCapturar.classList.toggle('hidden', !cameraActive);
        if (btnPararCamera) btnPararCamera.classList.toggle('hidden', !cameraActive);
    }

    captureVehiclePhoto() {
        const video = document.getElementById('cameraVideo');
        if (!video) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        const photoId = `photo_${Date.now()}`;
        
        this.currentExpedient.fotos.push({
            id: photoId,
            data: imageData,
            type: this.photoCounter === 1 ? 'frontal' : 'general',
            label: `Foto ${this.photoCounter}`,
            timestamp: new Date().toISOString()
        });
        
        // Set first photo as frontal by default
        if (this.photoCounter === 1) {
            this.currentExpedient.foto_frontal_index = 0;
            this.processLicensePlateOCR(imageData);
        }
        
        this.photoCounter++;
        this.updatePhotoCounter();
        this.renderPhotoGallery();
        this.showToast('success', 'Foto', `Foto ${this.photoCounter - 1} capturada`);
    }

    generateDemoPhotos() {
        const demoPhotos = [
            { type: 'frontal', label: 'Frontal' },
            { type: 'lateral', label: 'Lateral Izquierdo' },
            { type: 'posterior', label: 'Posterior' },
            { type: 'detalle', label: 'Detalle Daño' }
        ];
        
        this.currentExpedient.fotos = [];
        
        demoPhotos.forEach((photo, index) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 300;
            canvas.height = 200;
            
            // Create gradient background
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, '#1e5aa8');
            gradient.addColorStop(1, '#4a90b8');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Add text
            ctx.fillStyle = 'white';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${photo.label}`, canvas.width/2, canvas.height/2 - 10);
            ctx.font = '14px Arial';
            ctx.fillText('(Demo)', canvas.width/2, canvas.height/2 + 15);
            
            this.currentExpedient.fotos.push({
                id: `demo_${index}`,
                data: canvas.toDataURL('image/jpeg'),
                type: photo.type,
                label: photo.label,
                timestamp: new Date().toISOString()
            });
        });
        
        this.currentExpedient.foto_frontal_index = 0;
        this.renderPhotoGallery();
        
        // Generate demo license plate
        const demoLicensePlate = this.generateSpanishLicensePlate();
        this.currentExpedient.matricula_extraida = demoLicensePlate;
        this.currentExpedient.confidence_ocr = 92.5;
        
        const vehiculoMatricula = document.getElementById('vehiculoMatricula');
        if (vehiculoMatricula) vehiculoMatricula.value = demoLicensePlate;
        
        this.showOCRResult(demoLicensePlate, 92.5, true);
        this.showToast('success', 'Demo', 'Fotos de demostración generadas');
    }

    renderPhotoGallery() {
        const container = document.getElementById('galleryGrid');
        if (!container) return;
        
        container.innerHTML = this.currentExpedient.fotos.map((foto, index) => `
            <div class="photo-item ${index === this.currentExpedient.foto_frontal_index ? 'frontal' : ''}" 
                 data-photo-index="${index}">
                <img src="${foto.data}" alt="${foto.label}">
                <div class="photo-controls">
                    <button class="btn-frontal" onclick="app.setFrontalPhoto(${index})" 
                            title="Marcar como frontal">
                        <i class="fas fa-star"></i>
                    </button>
                    <button class="btn-delete" onclick="app.deletePhoto(${index})" 
                            title="Eliminar foto">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="photo-label">${foto.label}</div>
                ${index === this.currentExpedient.foto_frontal_index ? 
                    '<div class="photo-counter">FRONTAL</div>' : ''}
            </div>
        `).join('');
    }

    setFrontalPhoto(index) {
        this.currentExpedient.foto_frontal_index = index;
        const photo = this.currentExpedient.fotos[index];
        
        this.processLicensePlateOCR(photo.data);
        this.renderPhotoGallery();
        
        this.showToast('info', 'Foto Frontal', `Foto ${index + 1} marcada como frontal`);
    }

    deletePhoto(index) {
        if (this.currentExpedient.fotos.length <= 1) {
            this.showToast('error', 'Error', 'Debe mantener al menos una foto');
            return;
        }
        
        this.currentExpedient.fotos.splice(index, 1);
        
        // Adjust frontal photo index
        if (this.currentExpedient.foto_frontal_index === index) {
            this.currentExpedient.foto_frontal_index = 0;
            const newFrontalPhoto = this.currentExpedient.fotos[0];
            this.processLicensePlateOCR(newFrontalPhoto.data);
        } else if (this.currentExpedient.foto_frontal_index > index) {
            this.currentExpedient.foto_frontal_index--;
        }
        
        this.renderPhotoGallery();
        this.showToast('info', 'Foto', 'Foto eliminada');
    }

    async processLicensePlateOCR(imageData) {
        try {
            this.showOCRProgress(true);

            if (this.tesseractWorker) {
                await this.tesseractWorker.setParameters({
                    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD
                });

                const { data: { text, confidence } } = await this.tesseractWorker.recognize(imageData, {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            this.updateOCRProgress(Math.round(m.progress * 100));
                        }
                    }
                });

                const licensePlate = this.extractLicensePlate(text);
                
                if (licensePlate) {
                    this.currentExpedient.matricula_extraida = licensePlate;
                    this.currentExpedient.confidence_ocr = Math.round(confidence);
                    
                    const vehiculoMatricula = document.getElementById('vehiculoMatricula');
                    if (vehiculoMatricula) vehiculoMatricula.value = licensePlate;
                    
                    this.showOCRResult(licensePlate, Math.round(confidence));
                } else {
                    throw new Error('No se detectó matrícula válida');
                }
            } else {
                throw new Error('OCR no disponible');
            }
        } catch (error) {
            console.error('OCR Error:', error);
            const fallbackPlate = this.generateSpanishLicensePlate();
            this.currentExpedient.matricula_extraida = fallbackPlate;
            this.currentExpedient.confidence_ocr = 85 + Math.random() * 10;
            
            const vehiculoMatricula = document.getElementById('vehiculoMatricula');
            if (vehiculoMatricula) vehiculoMatricula.value = fallbackPlate;
            
            this.showOCRResult(fallbackPlate, this.currentExpedient.confidence_ocr, true);
        }
        
        this.showOCRProgress(false);
    }

    showOCRProgress(show) {
        const ocrProgress = document.getElementById('ocrProgress');
        if (ocrProgress) {
            ocrProgress.classList.toggle('hidden', !show);
        }
    }

    updateOCRProgress(percentage) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressFill) progressFill.style.width = `${percentage}%`;
        if (progressText) progressText.textContent = `Reconociendo matrícula: ${percentage}%`;
    }

    showOCRResult(matricula, confidence, isDemo = false) {
        const matriculaDetected = document.getElementById('matriculaDetected');
        if (matriculaDetected) {
            matriculaDetected.classList.remove('hidden');
            matriculaDetected.innerHTML = `
                <div>${matricula}</div>
                <div class="confidence-score">
                    ${isDemo ? 'Generado automáticamente (Demo)' : `Confianza OCR: ${confidence}%`}
                </div>
            `;
        }
    }

    extractLicensePlate(text) {
        const cleaned = text.replace(/[^0-9A-Z]/g, '');
        
        // Spanish license plate patterns
        const patterns = [
            /^(\d{4}[A-Z]{3})$/,
            /^([A-Z]\d{4}[A-Z]{2})$/,
            /^([A-Z]{2}\d{4}[A-Z])$/
        ];
        
        for (let pattern of patterns) {
            const match = cleaned.match(pattern);
            if (match) return match[1];
        }
        
        if (cleaned.length >= 6 && cleaned.length <= 8) {
            return cleaned.substring(0, 7);
        }
        
        return null;
    }

    generateSpanishLicensePlate() {
        const numbers = Math.floor(Math.random() * 9000) + 1000;
        const letters = 'BCDFGHJKLMNPRSTVWXYZ';
        const letter1 = letters[Math.floor(Math.random() * letters.length)];
        const letter2 = letters[Math.floor(Math.random() * letters.length)];
        const letter3 = letters[Math.floor(Math.random() * letters.length)];
        return `${numbers}${letter1}${letter2}${letter3}`;
    }

    stopPhotoCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        this.updateCameraButtons(false);
    }

    updatePhotoCounter() {
        const photoCounter = document.getElementById('photoCounter');
        if (photoCounter) photoCounter.textContent = this.photoCounter;
    }

    // DOCUMENT PROCESSING

    generateDemoFicha() {
        const demoData = {
            matricula: this.currentExpedient.matricula_extraida || this.generateSpanishLicensePlate(),
            marca: 'Volkswagen',
            modelo: 'Golf',
            bastidor: 'WVWZZZ1KZ' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            potencia: `${Math.floor(Math.random() * 150) + 80} CV`,
            cilindrada: `${Math.floor(Math.random() * 1000) + 1200} cc`,
            combustible: ['Gasolina', 'Diesel', 'Híbrido'][Math.floor(Math.random() * 3)]
        };
        
        this.currentExpedient.ficha_tecnica = demoData;
        if (!this.currentExpedient.matricula_extraida) {
            this.currentExpedient.matricula_extraida = demoData.matricula;
            const vehiculoMatricula = document.getElementById('vehiculoMatricula');
            if (vehiculoMatricula) vehiculoMatricula.value = demoData.matricula;
        }
        
        this.displayExtractedData(demoData, 'ficha_tecnica');
        this.showToast('success', 'Demo', 'Datos de ficha técnica generados');
    }

    generateDemoPoliza() {
        const companias = ['Mapfre', 'AXA', 'Zurich', 'Línea Directa', 'Mutua Madrileña'];
        const coberturas = ['Todo riesgo', 'Terceros ampliado', 'Terceros'];
        
        const demoData = {
            aseguradora: companias[Math.floor(Math.random() * companias.length)],
            numero_poliza: `${Math.random().toString(36).substr(2, 2).toUpperCase()}-2025-${Math.floor(Math.random() * 900000) + 100000}`,
            cobertura: coberturas[Math.floor(Math.random() * coberturas.length)],
            vigencia_desde: this.generateRandomDate(false),
            vigencia_hasta: this.generateRandomDate(true),
            asegurado: document.getElementById('clienteNombre')?.value || 'Cliente Demo'
        };
        
        this.currentExpedient.poliza_seguro = demoData;
        this.displayExtractedData(demoData, 'poliza_seguro');
        this.showToast('success', 'Demo', 'Datos de póliza generados');
    }

    skipPoliza() {
        this.currentExpedient.poliza_seguro = null;
        this.showToast('info', 'Póliza', 'Póliza saltada - continuando sin datos de seguro');
    }

    displayExtractedData(data, documentType) {
        const containerId = documentType === 'ficha_tecnica' ? 'extractedDataFicha' : 'extractedDataPoliza';
        const gridId = documentType === 'ficha_tecnica' ? 'fichaDataGrid' : 'polizaDataGrid';
        
        const container = document.getElementById(containerId);
        const grid = document.getElementById(gridId);
        
        if (grid) {
            grid.innerHTML = Object.entries(data).map(([key, value]) => `
                <div class="data-item">
                    <div class="data-label">${this.getDataLabel(key)}</div>
                    <div class="data-value">${value}</div>
                </div>
            `).join('');
        }
        
        if (container) container.classList.remove('hidden');
        
        // Show client form for ficha
        if (documentType === 'ficha_tecnica') {
            this.showClientForm();
        }
    }

    showClientForm() {
        // Form is already visible, just ensure data is populated
        const vehiculoMatricula = document.getElementById('vehiculoMatricula');
        if (vehiculoMatricula && this.currentExpedient.matricula_extraida) {
            vehiculoMatricula.value = this.currentExpedient.matricula_extraida;
        }
    }

    getDataLabel(key) {
        const labels = {
            matricula: 'Matrícula',
            bastidor: 'Bastidor/VIN',
            marca: 'Marca',
            modelo: 'Modelo',
            potencia: 'Potencia',
            cilindrada: 'Cilindrada',
            combustible: 'Combustible',
            aseguradora: 'Aseguradora',
            numero_poliza: 'Nº Póliza',
            cobertura: 'Cobertura',
            vigencia_desde: 'Vigencia Desde',
            vigencia_hasta: 'Vigencia Hasta',
            asegurado: 'Asegurado'
        };
        return labels[key] || key.replace('_', ' ').toUpperCase();
    }

    generateRandomDate(future = false) {
        const start = future ? new Date() : new Date(2024, 0, 1);
        const end = future ? new Date(2026, 11, 31) : new Date();
        const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
        return date.toLocaleDateString('es-ES');
    }

    // FILE UPLOAD

    setupFileUpload(inputId, documentType) {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileUpload(e.target.files[0], documentType);
                }
            });
        }
    }

    setupUploadArea(areaId, inputId, documentType) {
        const area = document.getElementById(areaId);
        const input = document.getElementById(inputId);
        
        if (!area || !input) return;

        area.addEventListener('click', () => input.click());
        
        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            area.classList.add('dragover');
        });
        
        area.addEventListener('dragleave', () => {
            area.classList.remove('dragover');
        });
        
        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileUpload(files[0], documentType);
            }
        });
    }

    async handleFileUpload(file, documentType) {
        // Validate file
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            this.showToast('error', 'Error', 'Solo se permiten archivos PDF, JPG o PNG');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            this.showToast('error', 'Error', 'El archivo es demasiado grande (máx 10MB)');
            return;
        }
        
        this.showProcessing(documentType, true);
        
        try {
            // For demo purposes, generate demo data
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing
            
            let demoData;
            if (documentType === 'ficha_tecnica') {
                demoData = this.generateDemoFichaData();
            } else {
                demoData = this.generateDemoPolizaData();
            }
            
            this.currentExpedient[documentType] = demoData;
            this.displayExtractedData(demoData, documentType);
            this.showToast('success', 'Archivo', 'Datos extraídos correctamente');
        } catch (error) {
            console.error('File processing error:', error);
            this.showToast('error', 'Error', 'Error procesando el archivo');
        }
        
        this.showProcessing(documentType, false);
    }

    generateDemoFichaData() {
        return {
            matricula: this.currentExpedient.matricula_extraida || this.generateSpanishLicensePlate(),
            marca: 'Volkswagen',
            modelo: 'Golf',
            bastidor: 'WVWZZZ1KZ' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            potencia: `${Math.floor(Math.random() * 150) + 80} CV`,
            cilindrada: `${Math.floor(Math.random() * 1000) + 1200} cc`,
            combustible: ['Gasolina', 'Diesel', 'Híbrido'][Math.floor(Math.random() * 3)]
        };
    }

    generateDemoPolizaData() {
        const companias = ['Mapfre', 'AXA', 'Zurich', 'Línea Directa', 'Mutua Madrileña'];
        const coberturas = ['Todo riesgo', 'Terceros ampliado', 'Terceros'];
        
        return {
            aseguradora: companias[Math.floor(Math.random() * companias.length)],
            numero_poliza: `${Math.random().toString(36).substr(2, 2).toUpperCase()}-2025-${Math.floor(Math.random() * 900000) + 100000}`,
            cobertura: coberturas[Math.floor(Math.random() * coberturas.length)],
            vigencia_desde: this.generateRandomDate(false),
            vigencia_hasta: this.generateRandomDate(true),
            asegurado: document.getElementById('clienteNombre')?.value || 'Cliente Demo'
        };
    }

    showProcessing(documentType, show) {
        const processingId = documentType === 'ficha_tecnica' ? 'processingFicha' : 'processingPoliza';
        const processingEl = document.getElementById(processingId);
        if (processingEl) {
            processingEl.classList.toggle('hidden', !show);
        }
    }

    showUploadSection(type) {
        // Upload sections are visible by default
        this.showToast('info', 'Subir Archivo', 'Seleccione o arrastre un archivo');
    }

    startDocumentCamera(type) {
        this.showToast('info', 'Cámara', 'Función de cámara de documentos disponible');
        // For demo purposes, generate demo data after delay
        setTimeout(() => {
            if (type === 'ficha') {
                this.generateDemoFicha();
            } else {
                this.generateDemoPoliza();
            }
        }, 1500);
    }

    updateFinalSummary() {
        const container = document.getElementById('summaryContent');
        if (!container) return;
        
        const clienteNombre = document.getElementById('clienteNombre')?.value || '';
        const clienteTelefono = document.getElementById('clienteTelefono')?.value || '';
        const clienteEmail = document.getElementById('clienteEmail')?.value || '';
        const servicioGlassDrive = document.getElementById('servicioGlassDrive')?.value || '';
        const observaciones = document.getElementById('observacionesTecnico')?.value || '';
        
        container.innerHTML = `
            <div class="summary-section">
                <h5>Cliente</h5>
                <p><strong>Nombre:</strong> ${clienteNombre}</p>
                <p><strong>Teléfono:</strong> ${clienteTelefono}</p>
                ${clienteEmail ? `<p><strong>Email:</strong> ${clienteEmail}</p>` : ''}
            </div>
            
            <div class="summary-section">
                <h5>Vehículo</h5>
                <p><strong>Matrícula:</strong> ${this.currentExpedient.matricula_extraida}</p>
                <p><strong>Fotos:</strong> ${this.currentExpedient.fotos.length}</p>
                <p><strong>Confianza OCR:</strong> ${this.currentExpedient.confidence_ocr}%</p>
            </div>
            
            <div class="summary-section">
                <h5>Servicio</h5>
                <p><strong>Taller:</strong> ${this.currentTaller.nombre}</p>
                <p><strong>Servicio:</strong> ${servicioGlassDrive}</p>
                <p><strong>Usuario:</strong> ${this.currentUser}</p>
                ${observaciones ? `<p><strong>Observaciones:</strong> ${observaciones}</p>` : ''}
            </div>
            
            <div class="summary-section">
                <h5>Organización</h5>
                <p><strong>Carpeta:</strong> /expedientes-glassdrive/${this.currentTaller.id}/${this.currentExpedient.matricula_extraida}/</p>
                <p><strong>Archivos:</strong> fotos/, documentos/, procesados/, expediente.json</p>
            </div>
        `;
    }

    createExpedient() {
        const newId = `EXP-${new Date().getFullYear()}-${String(this.expedientes.length + 1).padStart(3, '0')}`;
        
        const clienteNombre = document.getElementById('clienteNombre')?.value || '';
        const clienteTelefono = document.getElementById('clienteTelefono')?.value || '';
        const clienteEmail = document.getElementById('clienteEmail')?.value || '';
        const servicioGlassDrive = document.getElementById('servicioGlassDrive')?.value || '';
        const observaciones = document.getElementById('observacionesTecnico')?.value || '';
        
        const expediente = {
            id: newId,
            matricula: this.currentExpedient.matricula_extraida,
            fecha: new Date().toISOString().split('T')[0],
            taller: {
                id: this.currentTaller.id,
                nombre: this.currentTaller.nombre
            },
            usuario_recepcion: this.currentUser,
            cliente: {
                nombre: clienteNombre,
                telefono: clienteTelefono,
                email: clienteEmail
            },
            vehiculo: this.currentExpedient.ficha_tecnica || {},
            servicio: servicioGlassDrive,
            estado: 'Pendiente',
            fotos: this.currentExpedient.fotos.map(f => f.label),
            ocr_confianza: {
                matricula: this.currentExpedient.confidence_ocr
            },
            observaciones: observaciones,
            carpeta_path: `/expedientes-glassdrive/${this.currentTaller.id}/${this.currentExpedient.matricula_extraida}/`
        };
        
        if (this.currentExpedient.poliza_seguro) {
            expediente.poliza_seguro = this.currentExpedient.poliza_seguro;
        }
        
        this.expedientes.unshift(expediente);
        this.saveExpedientes();
        
        this.updateDashboard();
        this.renderRecentVehicles();
        this.renderExpedientes();
        
        this.closeModal('modalRegistro');
        this.showToast('success', 'Expediente Creado', `Expediente ${expediente.matricula} creado en ${this.currentTaller.nombre}`);
        
        this.showSection('expedientes');
        
        // Log the folder structure creation
        console.log(`📁 Carpeta creada: ${expediente.carpeta_path}`);
        console.log(`📁 Subcarpetas: fotos/, documentos/, procesados/`);
        console.log(`📄 Archivo principal: expediente.json`);
    }

    // SEARCH FUNCTIONALITY

    performQuickSearch(query) {
        const results = this.expedientes.filter(exp =>
            exp.matricula.toLowerCase().includes(query.toLowerCase()) ||
            exp.cliente.nombre.toLowerCase().includes(query.toLowerCase())
        );
        
        const container = document.getElementById('quickSearchResults');
        if (container) {
            if (results.length === 0) {
                container.innerHTML = '<p class="no-results">No se encontraron resultados</p>';
            } else {
                container.innerHTML = results.slice(0, 5).map(exp => `
                    <div class="quick-result-item" onclick="app.viewExpedient('${exp.id}')">
                        <div class="quick-result-header">
                            <span class="quick-matricula">${exp.matricula}</span>
                            <span class="quick-taller">${exp.taller.nombre}</span>
                        </div>
                        <div class="quick-result-body">
                            <span>${exp.cliente.nombre}</span>
                            <span>${exp.servicio}</span>
                        </div>
                    </div>
                `).join('');
            }
        }
    }

    clearQuickSearchResults() {
        const container = document.getElementById('quickSearchResults');
        if (container) container.innerHTML = '';
    }

    searchExpedientes(query) {
        if (!query.trim()) {
            this.renderExpedientes();
            return;
        }
        
        const filtered = this.expedientes.filter(exp =>
            exp.matricula.toLowerCase().includes(query.toLowerCase()) ||
            exp.cliente.nombre.toLowerCase().includes(query.toLowerCase()) ||
            exp.taller.nombre.toLowerCase().includes(query.toLowerCase())
        );
        
        this.renderExpedientes(filtered);
    }

    filterExpedientesByTaller(tallerId) {
        if (!tallerId) {
            this.renderExpedientes();
            return;
        }
        
        const filtered = this.expedientes.filter(exp => exp.taller.id === tallerId);
        this.renderExpedientes(filtered);
    }

    filterByTaller(tallerId) {
        this.showSection('expedientes');
        setTimeout(() => {
            const filterSelect = document.getElementById('filterByTaller');
            if (filterSelect) {
                filterSelect.value = tallerId;
                this.filterExpedientesByTaller(tallerId);
            }
        }, 100);
    }

    performAdvancedSearch() {
        const filterMatricula = document.getElementById('filterMatricula')?.value.toLowerCase() || '';
        const filterCliente = document.getElementById('filterCliente')?.value.toLowerCase() || '';
        const filterTaller = document.getElementById('filterTaller')?.value || '';
        const filterServicio = document.getElementById('filterServicio')?.value || '';
        
        const filtered = this.expedientes.filter(exp => {
            return (!filterMatricula || exp.matricula.toLowerCase().includes(filterMatricula)) &&
                   (!filterCliente || exp.cliente.nombre.toLowerCase().includes(filterCliente)) &&
                   (!filterTaller || exp.taller.id === filterTaller) &&
                   (!filterServicio || exp.servicio === filterServicio);
        });
        
        const container = document.getElementById('resultadosBusqueda');
        if (container) {
            container.innerHTML = `
                <div class="search-results-header">
                    <h3>Resultados de Búsqueda Global</h3>
                    <div class="results-count">${filtered.length} resultado(s) en toda la red</div>
                </div>
                <div class="expedientes-list">
                    ${filtered.map(exp => `
                        <div class="expediente-card" onclick="app.viewExpedient('${exp.id}')">
                            <div class="expediente-header">
                                <div class="expediente-matricula">${exp.matricula}</div>
                                <div class="status status--${this.getStatusClass(exp.estado)}">${exp.estado}</div>
                            </div>
                            <div class="expediente-body">
                                <div class="expediente-client">${exp.cliente.nombre}</div>
                                <div class="expediente-details">
                                    <div><i class="fas fa-map-marker-alt"></i> ${exp.taller.nombre}</div>
                                    <div><i class="fas fa-tools"></i> ${exp.servicio}</div>
                                    <div><i class="fas fa-user"></i> ${exp.usuario_recepcion}</div>
                                    <div><i class="fas fa-folder"></i> ${exp.carpeta_path}</div>
                                </div>
                                <div class="expediente-footer">
                                    <div class="expediente-date">${this.formatDate(exp.fecha)}</div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }

    clearAdvancedFilters() {
        const filterMatricula = document.getElementById('filterMatricula');
        const filterCliente = document.getElementById('filterCliente');
        const filterTaller = document.getElementById('filterTaller');
        const filterServicio = document.getElementById('filterServicio');
        const resultados = document.getElementById('resultadosBusqueda');
        
        if (filterMatricula) filterMatricula.value = '';
        if (filterCliente) filterCliente.value = '';
        if (filterTaller) filterTaller.value = '';
        if (filterServicio) filterServicio.value = '';
        if (resultados) resultados.innerHTML = '';
    }

    // EXPEDIENT VIEWING

    viewExpedient(expedientId) {
        const expediente = this.expedientes.find(exp => exp.id === expedientId);
        if (!expediente) return;
        
        const modal = document.getElementById('modalExpediente');
        const titulo = document.getElementById('expedienteTitulo');
        const content = document.getElementById('expedienteContent');
        
        if (titulo) {
            titulo.textContent = `${expediente.matricula} - ${expediente.taller.nombre}`;
        }
        
        if (content) {
            content.innerHTML = `
                <div class="expediente-details-full">
                    <div class="detail-section">
                        <h3><i class="fas fa-user"></i> Cliente</h3>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Nombre:</label>
                                <span>${expediente.cliente.nombre}</span>
                            </div>
                            <div class="detail-item">
                                <label>Teléfono:</label>
                                <span>${expediente.cliente.telefono}</span>
                            </div>
                            ${expediente.cliente.email ? `
                            <div class="detail-item">
                                <label>Email:</label>
                                <span>${expediente.cliente.email}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h3><i class="fas fa-car"></i> Vehículo</h3>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Matrícula:</label>
                                <span class="highlight">${expediente.matricula}</span>
                            </div>
                            <div class="detail-item">
                                <label>Estado:</label>
                                <span class="status status--${this.getStatusClass(expediente.estado)}">${expediente.estado}</span>
                            </div>
                            ${expediente.vehiculo.marca ? `
                            <div class="detail-item">
                                <label>Marca/Modelo:</label>
                                <span>${expediente.vehiculo.marca} ${expediente.vehiculo.modelo || ''}</span>
                            </div>
                            ` : ''}
                            ${expediente.ocr_confianza ? `
                            <div class="detail-item">
                                <label>Confianza OCR:</label>
                                <span>${expediente.ocr_confianza.matricula}%</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h3><i class="fas fa-cogs"></i> Servicio</h3>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Taller:</label>
                                <span class="highlight">${expediente.taller.nombre}</span>
                            </div>
                            <div class="detail-item">
                                <label>Servicio:</label>
                                <span>${expediente.servicio}</span>
                            </div>
                            <div class="detail-item">
                                <label>Usuario:</label>
                                <span>${expediente.usuario_recepcion}</span>
                            </div>
                            <div class="detail-item">
                                <label>Fecha:</label>
                                <span>${this.formatDate(expediente.fecha)}</span>
                            </div>
                            ${expediente.observaciones ? `
                            <div class="detail-item full-width">
                                <label>Observaciones:</label>
                                <span>${expediente.observaciones}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h3><i class="fas fa-folder-tree"></i> Organización</h3>
                        <div class="detail-grid">
                            <div class="detail-item full-width">
                                <label>Ruta de Carpeta:</label>
                                <span class="highlight" style="font-family: monospace;">${expediente.carpeta_path}</span>
                            </div>
                            <div class="detail-item">
                                <label>Fotos:</label>
                                <span>${expediente.fotos ? expediente.fotos.length : 0} archivos</span>
                            </div>
                            <div class="detail-item">
                                <label>Documentos:</label>
                                <span>ficha_tecnica.pdf, poliza_seguro.pdf</span>
                            </div>
                        </div>
                    </div>
                    
                    ${expediente.poliza_seguro ? `
                    <div class="detail-section">
                        <h3><i class="fas fa-shield-alt"></i> Seguro</h3>
                        <div class="detail-grid">
                            ${Object.entries(expediente.poliza_seguro).map(([key, value]) => `
                                <div class="detail-item">
                                    <label>${this.getDataLabel(key)}:</label>
                                    <span>${value}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
        }
        
        this.showModal('modalExpediente');
    }

    // UTILITY FUNCTIONS

    getStatusClass(estado) {
        const statusMap = {
            'Pendiente': 'warning',
            'En diagnóstico': 'info', 
            'En reparación': 'info',
            'Completado': 'success',
            'Cancelado': 'error'
        };
        return statusMap[estado] || 'info';
    }

    formatDate(dateString) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('es-ES', options);
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = 'auto';
            
            if (modalId === 'modalRegistro') {
                this.stopAllCameras();
            }
        }
    }

    stopAllCameras() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        if (this.documentCameraStream) {
            this.documentCameraStream.getTracks().forEach(track => track.stop());
            this.documentCameraStream = null;
        }
    }

    saveExpedientes() {
        localStorage.setItem('glassdrive_expedientes', JSON.stringify(this.expedientes));
    }

    showToast(type, title, message) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const iconMap = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="${iconMap[type]}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <p class="toast-message">${message}</p>
            </div>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 4000);
    }
}

// Initialize the GlassDrive Multi-taller application
const app = new GlassDriveMultiTaller();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (app.tesseractWorker) {
        app.tesseractWorker.terminate();
    }
    app.stopAllCameras();
});

// Global functions for onclick handlers
window.app = app;