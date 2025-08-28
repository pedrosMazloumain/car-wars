// --- استيراد المكتبات الأساسية من CDN ---
// مكتبة Three.js لإنشاء الرسومات ثلاثية الأبعاد
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';
// مكتبة Multisynq لإدارة حالة اللعبة متعددة اللاعبين
import * as Multisynq from 'https://cdn.jsdelivr.net/npm/@multisynq/client@latest/bundled/multisynq-client.esm.js';

// =====================================================================================
// الفئة المسؤولة عن محاكاة حالة اللعبة (الجانب المنطقي)
// =====================================================================================
class SharedSimulation {
    constructor() {
        // مصفوفة لتخزين بيانات كل سيارة في اللعبة
        this.cars = [];
    }

    // هذه الدالة تُستدعى تلقائيًا بواسطة Multisynq عند انضمام لاعب جديد
    onPlayerAdded(player) {
        // إنشاء سيارة جديدة للاعب الجديد وإضافتها للمحاكاة
        const car = new SimCar();
        car.playerId = player.id; // ربط السيارة باللاعب
        // إعطاء السيارة لونًا عشوائيًا
        car.color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        this.cars.push(car);
    }

    // هذه الدالة تُستدعى تلقائيًا بواسطة Multisynq عند مغادرة لاعب
    onPlayerRemoved(player) {
        // إزالة سيارة اللاعب الذي غادر من مصفوفة السيارات
        const index = this.cars.findIndex(c => c.playerId === player.id);
        if (index !== -1) {
            this.cars.splice(index, 1);
        }
    }
}

// =====================================================================================
// فئة تمثل بيانات سيارة واحدة في المحاكاة
// =====================================================================================
class SimCar {
    constructor() {
        this.playerId = ''; // معرّف اللاعب المالك للسيارة
        this.color = '#ff0000'; // اللون الافتراضي

        // متغيرات الحركة والفيزياء
        this.position = { x: (Math.random() - 0.5) * 10, y: 0.5, z: (Math.random() - 0.5) * 10 };
        this.rotation = { x: 0, y: 0, z: 0 };
        this.velocity = { x: 0, z: 0 };

        // متغيرات التحكم
        this.controls = { forward: false, backward: false, left: false, right: false };
        this.speed = 0.0;
        this.maxSpeed = 0.15;
        this.acceleration = 0.005;
        this.friction = 0.98; // معامل احتكاك لإبطاء السيارة
        this.turnSpeed = 0.04; // سرعة الانعطاف
    }

    // دالة لتحديث حالة السيارة بناءً على مدخلات التحكم
    update() {
        // التعامل مع الحركة للأمام والخلف
        if (this.controls.forward) {
            this.speed += this.acceleration;
        }
        if (this.controls.backward) {
            this.speed -= this.acceleration;
        }

        // تحديد أقصى سرعة
        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        if (this.speed < -this.maxSpeed / 2) this.speed = -this.maxSpeed / 2;

        // تطبيق الاحتكاك
        this.speed *= this.friction;

        // التعامل مع الانعطاف (فقط عند الحركة)
        if (Math.abs(this.speed) > 0.001) {
            const flip = this.speed > 0 ? 1 : -1;
            if (this.controls.left) {
                this.rotation.y += this.turnSpeed * flip;
            }
            if (this.controls.right) {
                this.rotation.y -= this.turnSpeed * flip;
            }
        }
        
        // تحديث الموضع بناءً على السرعة والاتجاه
        this.velocity.x = Math.sin(this.rotation.y) * this.speed;
        this.velocity.z = Math.cos(this.rotation.y) * this.speed;

        this.position.x -= this.velocity.x;
        this.position.z -= this.velocity.z;
    }
}


// =====================================================================================
// فئة الواجهة الرسومية (View) المسؤولة عن عرض اللعبة باستخدام Three.js
// =====================================================================================
class SimInterface {
    constructor(simulation, session) {
        this.simulation = simulation;
        this.session = session;
        this.carObjects = new Map(); // لتخزين كائنات Three.js للسيارات

        this.init(); // بدء إعداد المشهد
        this.setupControls(); // إعداد وحدات التحكم
        this.addScenery(); // إضافة العناصر التجميلية للمشهد
    }

    // --- إعداد المشهد الأساسي ---
    init() {
        // إنشاء الكاميرا
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 10, 15);
        this.camera.lookAt(0, 0, 0);

        // إنشاء المشهد
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // لون السماء
        this.scene.fog = new THREE.Fog(0x87ceeb, 50, 200);


        // إنشاء العارض (Renderer)
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // إضافة الإضاءة
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(20, 30, 15);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.top = 20;
        directionalLight.shadow.camera.bottom = -20;
        directionalLight.shadow.camera.left = -20;
        directionalLight.shadow.camera.right = 20;
        this.scene.add(directionalLight);

        // إنشاء الأرضية والطريق
        const groundGeo = new THREE.PlaneGeometry(500, 500);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0x559020 }); // أخضر
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        const roadGeo = new THREE.PlaneGeometry(10, 500);
        const roadMat = new THREE.MeshLambertMaterial({ color: 0x333333 }); // أسود
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.rotation.x = -Math.PI / 2;
        road.position.y = 0.01; // فوق الأرضية بقليل
        road.receiveShadow = true;
        this.scene.add(road);


        // التعامل مع تغيير حجم النافذة
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    // --- إضافة العناصر التجميلية (جبال، أشجار، سحاب) ---
    addScenery() {
        // إضافة الجبال
        for (let i = 0; i < 20; i++) {
            const height = Math.random() * 30 + 10;
            const radius = height / 2.5;
            const mountainGeo = new THREE.ConeGeometry(radius, height, 16);
            const mountainMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // بني
            const mountain = new THREE.Mesh(mountainGeo, mountainMat);

            // إضافة قمة ثلجية للجبال الطويلة
            if (height > 30) {
                 const snowCapGeo = new THREE.ConeGeometry(radius * 0.4, height * 0.3, 16);
                 const snowCapMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
                 const snowCap = new THREE.Mesh(snowCapGeo, snowCapMat);
                 snowCap.position.y = height * 0.4; // وضعها في الأعلى
                 mountain.add(snowCap);
            }
           
            mountain.position.set(
                (Math.random() - 0.5) * 400,
                height / 2 - 0.1,
                (Math.random() - 0.5) * 400
            );
            this.scene.add(mountain);
        }

        // إضافة الأشجار
        for (let i = 0; i < 100; i++) {
             const tree = new THREE.Group();
             const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
             const trunkMat = new THREE.MeshLambertMaterial({ color: 0x654321 }); // بني
             const trunk = new THREE.Mesh(trunkGeo, trunkMat);

             const leavesGeo = new THREE.ConeGeometry(1.5, 4, 8);
             const leavesMat = new THREE.MeshLambertMaterial({ color: 0x228B22 }); // أخضر
             const leaves = new THREE.Mesh(leavesGeo, leavesMat);
             leaves.position.y = 3;
            
             tree.add(trunk);
             tree.add(leaves);
             tree.position.set(
                (Math.random() - 0.5) * 100,
                1,
                (Math.random() - 0.5) * 100
             );
             // تجنب وضع الأشجار على الطريق
             if (Math.abs(tree.position.x) < 7) continue;

             tree.castShadow = true;
             this.scene.add(tree);
        }

        // إضافة السحاب
        for (let i = 0; i < 30; i++) {
            const cloud = new THREE.Group();
            const mainSphere = new THREE.SphereGeometry(Math.random() * 5 + 2, 8, 8);
            const cloudMat = new THREE.MeshBasicMaterial({
                 color: 0xffffff,
                 transparent: true,
                 opacity: 0.7 
            });

            for (let j = 0; j < 5; j++) {
                const spherePart = new THREE.Mesh(mainSphere, cloudMat);
                spherePart.position.set(
                    (Math.random() - 0.5) * 8,
                    (Math.random() - 0.5) * 3,
                    (Math.random() - 0.5) * 5
                );
                cloud.add(spherePart);
            }

            cloud.position.set(
                (Math.random() - 0.5) * 300,
                Math.random() * 20 + 20, // ارتفاع السحاب
                (Math.random() - 0.5) * 300
            );
            this.scene.add(cloud);
        }
    }
    
    // --- إنشاء نموذج سيارة ثلاثي الأبعاد ---
    createCarMesh(color) {
        const car = new THREE.Group();

        // جسم السيارة
        const bodyGeo = new THREE.BoxGeometry(2, 1, 4);
        const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.2 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        car.add(body);

        // كابينة السيارة
        const cabinGeo = new THREE.BoxGeometry(1.8, 0.8, 2.5);
        const cabinMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.8 });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.y = 0.5;
        cabin.position.z = -0.2;
        car.add(cabin);

        // العجلات
        const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        
        const wheelPositions = [
            { x: 1.1, y: -0.2, z: 1.2 },
            { x: -1.1, y: -0.2, z: 1.2 },
            { x: 1.1, y: -0.2, z: -1.2 },
            { x: -1.1, y: -0.2, z: -1.2 },
        ];

        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos.x, pos.y, pos.z);
            wheel.castShadow = true;
            car.add(wheel);
        });

        return car;
    }

    // --- إعداد وحدات التحكم (كيبورد + أزرار لمس) ---
    setupControls() {
        const localCar = this.simulation.cars.find(c => c.playerId === this.session.player.id);
        if (!localCar) return;

        // --- التحكم بالكيبورد ---
        const keyMap = {};
        const onKeyChange = () => {
             localCar.controls.forward = keyMap['w'] || keyMap['ArrowUp'] || false;
             localCar.controls.backward = keyMap['s'] || keyMap['ArrowDown'] || false;
             localCar.controls.left = keyMap['a'] || keyMap['ArrowLeft'] || false;
             localCar.controls.right = keyMap['d'] || keyMap['ArrowRight'] || false;
        };

        document.addEventListener('keydown', (e) => {
            keyMap[e.key.toLowerCase()] = true;
            onKeyChange();
        });
        document.addEventListener('keyup', (e) => {
            keyMap[e.key.toLowerCase()] = false;
            onKeyChange();
        });

        // --- التحكم بأزرار اللمس ---
        const setupButton = (id, controlKey) => {
            const button = document.getElementById(id);
            const setControl = (value) => {
                localCar.controls[controlKey] = value;
                // يجب استدعاء onKeyChange للتأكد من تحديث كافة الحالات
                // هذا مفيد إذا تم الضغط على زرين معًا
                onKeyChange();
            };
            button.addEventListener('touchstart', (e) => { e.preventDefault(); setControl(true); }, { passive: false });
            button.addEventListener('touchend', (e) => { e.preventDefault(); setControl(false); }, { passive: false });
            button.addEventListener('mousedown', () => setControl(true));
            button.addEventListener('mouseup', () => setControl(false));
            button.addEventListener('mouseleave', () => setControl(false));
        };

        setupButton('btn-fwd', 'forward');
        setupButton('btn-bwd', 'backward');
        setupButton('btn-left', 'left');
        setupButton('btn-right', 'right');
    }

    // --- دالة التحديث الرئيسية (Game Loop) ---
    update() {
        // تحديث منطق كل سيارة في المحاكاة
        for (const car of this.simulation.cars) {
            car.update();

            // إضافة أو تحديث كائن السيارة في المشهد
            let carObj = this.carObjects.get(car.playerId);
            if (!carObj) {
                carObj = this.createCarMesh(car.color);
                this.carObjects.set(car.playerId, carObj);
                this.scene.add(carObj);

                // إذا كانت هذه هي سيارة اللاعب المحلي، قم بإعداد التحكم
                if (car.playerId === this.session.player.id) {
                    this.setupControls();
                }
            }

            // مزامنة موضع ودوران الكائن الرسومي مع بيانات المحاكاة
            carObj.position.set(car.position.x, car.position.y, car.position.z);
            carObj.rotation.set(car.rotation.x, car.rotation.y, car.rotation.z);
        }

        // إزالة سيارات اللاعبين الذين غادروا
        for (const [playerId, carObj] of this.carObjects.entries()) {
            if (!this.simulation.cars.some(c => c.playerId === playerId)) {
                this.scene.remove(carObj);
                this.carObjects.delete(playerId);
            }
        }
        
        // تحديث الكاميرا لتتبع سيارة اللاعب المحلي
        const localCarData = this.simulation.cars.find(c => c.playerId === this.session.player.id);
        const localCarObj = this.carObjects.get(this.session.player.id);

        if (localCarData && localCarObj) {
            const cameraOffset = new THREE.Vector3(0, 5, 10); // مسافة الكاميرا خلف السيارة
            // تدوير مسافة الكاميرا بناءً على دوران السيارة
            cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), localCarData.rotation.y);
            
            const cameraPosition = localCarObj.position.clone().add(cameraOffset);
            this.camera.position.lerp(cameraPosition, 0.1); // تحريك الكاميرا بسلاسة
            this.camera.lookAt(localCarObj.position);
        }
        
        // عرض المشهد
        this.renderer.render(this.scene, this.camera);
    }
}


// =====================================================================================
// --- نقطة الدخول: الانضمام إلى جلسة Multisynq وبدء اللعبة ---
// =====================================================================================

console.log("الانضمام إلى جلسة Multisynq...");

// ملاحظة هامة: يجب استبدال "YOUR_API_KEY_HERE" بمفتاح API الخاص بك من موقع multisynq.io
// يمكنك الحصول على مفتاح مجاني من لوحة التحكم بعد التسجيل.
Multisynq.Session.join({
    apiKey: "2sIWGGhjzCxnD3q373pGGamKkD2Lw2TJkXObGlutOa", // <-- ضع مفتاح API الخاص بك هنا
    name: location.origin + location.pathname, // اسم فريد للجلسة بناءً على رابط الصفحة
    password: "none",
    model: SharedSimulation, // الفئة المسؤولة عن منطق اللعبة
    view: SimInterface,      // الفئة المسؤولة عن عرض اللعبة
    debug: ["writes"]        // عرض بيانات المزامنة في الكونسول (مفيد للتصحيح)
}).then(app => {
    console.log("تم الانضمام بنجاح! التطبيق جاهز.");

    // استخراج الواجهة الرسومية (View)
    const view = app.view || app;

    // بدء حلقة اللعبة (Game Loop)
    const loop = () => {
        view.update(); // استدعاء دالة التحديث في كل إطار
        requestAnimationFrame(loop); // طلب الإطار التالي
    };

    loop(); // تشغيل الحلقة لأول مرة
}).catch(err => {
    // عرض رسالة خطأ واضحة في حالة فشل الانضمام
    console.error("فشل الانضمام إلى الجلسة:", err);
    document.body.innerHTML = `
        <div style="font-family: sans-serif; padding: 20px; text-align: center; color: red;">
            <h1>خطأ في الاتصال</h1>
            <p>لم نتمكن من الانضمام إلى جلسة اللعبة.</p>
            <p><strong>السبب المحتمل:</strong> قد يكون مفتاح API (apiKey) غير صحيح أو مفقود في ملف script.js.</p>
            <p>يرجى التأكد من استبدال <code>"YOUR_API_KEY_HERE"</code> بمفتاحك الصحيح من موقع multisynq.io.</p>
        </div>
    `;
});
