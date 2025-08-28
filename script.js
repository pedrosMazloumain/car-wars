/**
 * Cars War - 3D Multiplayer Racing Game
 *
 * هذا الملف يحتوي على كامل منطق اللعبة باستخدام Three.js للمحرك ثلاثي الأبعاد
 * و Multisynq لمزامنة حالة اللعبة بين اللاعبين في الوقت الفعلي.
 *
 * تأكد من أن لديك ملفي index.html و style.css في نفس المجلد.
 */

// --- 1. استيراد المكتبات الأساسية من CDN ---
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';
import * as Multisynq from 'https://cdn.jsdelivr.net/npm/@multisynq/client@latest/bundled/multisynq-client.esm.js';

// --- المتغيرات والثوابت الأساسية للعبة ---
const CAR_SPEED = 0.1;
const CAR_ROTATION_SPEED = 0.05;
const BULLET_SPEED = 0.5;

// --- 2. إعداد المشهد الثلاثي الأبعاد (SimInterface) ---
// هذه الفئة مسؤولة عن كل ما يراه اللاعب: المشهد، الكاميرا، الأضواء، والعناصر المرئية.
class SimInterface {
    constructor() {
        // --- إعداد أساسيات Three.js ---
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87ceeb); // نفس لون خلفية CSS
        this.renderer.shadowMap.enabled = true; // تفعيل الظلال
        document.body.appendChild(this.renderer.domElement);

        // --- إضافة الإضاءة ---
        // إضاءة محيطية خافتة لإضاءة المشهد بالكامل
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // إضاءة اتجاهية (مثل الشمس) لإعطاء ظلال
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(10, 20, 5);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);

        // --- إنشاء عناصر المشهد ---
        this.createEnvironment(); // الأرضية، الطريق، الجبال، الأشجار، إلخ.
        this.createObstacles(); // إضافة الحواجز الثابتة والمتحركة

        // --- إدارة اللاعبين والعناصر المتحركة ---
        this.cars = new Map(); // لتخزين كائنات السيارات ثلاثية الأبعاد
        this.bullets = new Map(); // لتخزين كائنات الرصاص
        this.healthBars = new Map(); // لتخزين أشرطة الحياة

        // --- إعداد التحكم ---
        this.input = { forward: false, backward: false, left: false, right: false, shoot: false };
        this.setupControls();

        // التعامل مع تغيير حجم النافذة
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    // --- 3. بناء بيئة اللعبة ---
    createEnvironment() {
        // الأرضية الخضراء
        const groundGeometry = new THREE.PlaneGeometry(300, 300);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x4CAF50 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // الطريق الأسود
        const roadGeometry = new THREE.PlaneGeometry(10, 300);
        const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.y = 0.01; // فوق الأرضية بقليل
        road.receiveShadow = true;
        this.scene.add(road);

        // الرصيف
        const sidewalkGeo = new THREE.BoxGeometry(1, 0.2, 300);
        const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
        const sidewalk1 = new THREE.Mesh(sidewalkGeo, sidewalkMat);
        sidewalk1.position.set(-5.5, 0.1, 0);
        this.scene.add(sidewalk1);
        const sidewalk2 = sidewalk1.clone();
        sidewalk2.position.set(5.5, 0.1, 0);
        this.scene.add(sidewalk2);

        // إضافة الجبال
        for (let i = 0; i < 20; i++) {
            this.createMountain(Math.random() * 200 - 100, Math.random() * 200 - 100);
        }

        // إضافة الأشجار
        for (let i = 0; i < 50; i++) {
            this.createTree(Math.random() * 100 - 50, Math.random() * 100 - 50);
        }

        // إضافة السحاب
        for (let i = 0; i < 15; i++) {
            this.createCloud();
        }
    }

    createMountain(x, z) {
        const height = Math.random() * 30 + 10;
        const geo = new THREE.ConeGeometry(Math.random() * 10 + 5, height, 8);
        const mat = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // بني
        const mountain = new THREE.Mesh(geo, mat);
        mountain.position.set(x, height / 2, z);
        this.scene.add(mountain);

        // قمة ثلجية للجبال الطويلة
        if (height > 30) {
            const snowGeo = new THREE.ConeGeometry(2, 5, 8);
            const snowMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
            const snow = new THREE.Mesh(snowGeo, snowMat);
            snow.position.y = height / 2 - 2.5;
            mountain.add(snow);
        }
    }

    createTree(x, z) {
        if (Math.abs(x) < 8) return; // لا تضع أشجارًا على الطريق
        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x654321 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(x, 1, z);

        const leavesGeo = new THREE.ConeGeometry(1.5, 4, 8);
        const leavesMat = new THREE.MeshLambertMaterial({ color: 0x008000 });
        const leaves = new THREE.Mesh(leavesGeo, leavesMat);
        leaves.position.y = 2;
        trunk.add(leaves);

        trunk.castShadow = true;
        this.scene.add(trunk);
    }

    createCloud() {
        const cloudGeo = new THREE.SphereGeometry(Math.random() * 5 + 2, 8, 8);
        const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
        const cloud = new THREE.Mesh(cloudGeo, cloudMat);
        cloud.position.set(Math.random() * 100 - 50, Math.random() * 10 + 20, Math.random() * 100 - 50);
        this.scene.add(cloud);
    }
    
    createObstacles() {
        // حواجز ثابتة
        const barrierGeo = new THREE.BoxGeometry(2, 1, 0.5);
        const barrierMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        for(let i = 0; i < 5; i++) {
            const barrier = new THREE.Mesh(barrierGeo, barrierMat);
            barrier.position.set(Math.random() * 8 - 4, 0.5, Math.random() * 200 - 100);
            barrier.castShadow = true;
            this.scene.add(barrier);
        }

        // سيارات متوقفة
        for (let i = 0; i < 10; i++) {
             const parkedCar = this.createCarMesh(new THREE.Color(0x555555)); // لون رمادي
             parkedCar.position.set(Math.random() > 0.5 ? 6.5 : -6.5, 0.5, Math.random() * 200 - 100);
             parkedCar.rotation.y = Math.PI / 2;
             this.scene.add(parkedCar);
        }

        // حاجز متحرك (سيمثل لاحقاً في محاكاة Multisynq)
        this.movingBarrier = new THREE.Mesh(
            new THREE.BoxGeometry(10, 1, 1),
            new THREE.MeshLambertMaterial({ color: 0xffff00 })
        );
        this.movingBarrier.position.y = 0.5;
        this.movingBarrier.castShadow = true;
        this.scene.add(this.movingBarrier);
    }

    // --- 4. إنشاء سيارة لاعب جديد ---
    createCarMesh(color) {
        const car = new THREE.Group();

        // جسم السيارة
        const bodyGeo = new THREE.BoxGeometry(1.5, 0.8, 3);
        const bodyMat = new THREE.MeshLambertMaterial({ color });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        car.add(body);

        // كابينة السيارة
        const cabinGeo = new THREE.BoxGeometry(1.2, 0.6, 1.5);
        const cabinMat = new THREE.MeshLambertMaterial({ color: 0xcccccc, transparent: true, opacity: 0.8 });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.y = 0.7;
        cabin.position.z = -0.2;
        car.add(cabin);

        // العجلات
        const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const positions = [
            { x: -0.9, y: -0.4, z: 1 },
            { x: 0.9, y: -0.4, z: 1 },
            { x: -0.9, y: -0.4, z: -1 },
            { x: 0.9, y: -0.4, z: -1 }
        ];

        positions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos.x, pos.y, pos.z);
            body.add(wheel);
        });

        // جهاز إطلاق الرصاص
        const gunGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8);
        const gunMat = new THREE.MeshLambertMaterial({color: 0x444444});
        const gun = new THREE.Mesh(gunGeo, gunMat);
        gun.rotation.x = Math.PI / 2;
        gun.position.set(0, 0.5, 1.9); // في مقدمة السيارة
        car.add(gun);

        return car;
    }
    
    // --- إنشاء شريط حياة للاعب ---
    createHealthBar(carId) {
        const healthBarContainer = document.createElement('div');
        healthBarContainer.className = 'health-bar-container';
        
        const healthBarFill = document.createElement('div');
        healthBarFill.className = 'health-bar-fill';
        
        healthBarContainer.appendChild(healthBarFill);
        document.body.appendChild(healthBarContainer);
        
        this.healthBars.set(carId, { container: healthBarContainer, fill: healthBarFill, carMesh: this.cars.get(carId) });
    }

    // --- تحديث أشرطة الحياة ---
    updateHealthBars() {
        this.healthBars.forEach((bar, carId) => {
            const { container, fill, carMesh } = bar;
            const health = this.simulation.state.cars[carId].health;
            
            fill.style.width = `${health}%`;
            if (health < 30) {
                fill.style.backgroundColor = 'red';
            } else if (health < 60) {
                fill.style.backgroundColor = 'orange';
            } else {
                fill.style.backgroundColor = 'green';
            }
            
            // تحديث موقع شريط الحياة ليتبع السيارة
            const screenPosition = this.getScreenPosition(carMesh);
            if(screenPosition.z < 1) { // التأكد من أن السيارة أمام الكاميرا
                 container.style.left = `${screenPosition.x}px`;
                 container.style.top = `${screenPosition.y}px`;
                 container.style.display = 'block';
            } else {
                 container.style.display = 'none';
            }
        });
    }

    getScreenPosition(object) {
        const vector = new THREE.Vector3();
        object.updateMatrixWorld();
        vector.setFromMatrixPosition(object.matrixWorld);
        vector.project(this.camera);
        
        vector.x = (vector.x * 0.5 + 0.5) * this.renderer.domElement.clientWidth;
        vector.y = (vector.y * -0.5 + 0.5) * this.renderer.domElement.clientHeight - 30; // -30 لرفعه فوق السيارة
        
        return vector;
    }


    // --- 5. إعداد التحكم (كيبورد و لمس) ---
    setupControls() {
        // التحكم بلوحة المفاتيح
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyW' || e.code === 'ArrowUp') this.input.forward = true;
            if (e.code === 'KeyS' || e.code === 'ArrowDown') this.input.backward = true;
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.input.left = true;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') this.input.right = true;
            if (e.code === 'Space') { // إطلاق النار بالضغط على Space
                 e.preventDefault();
                 this.input.shoot = true;
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'KeyW' || e.code === 'ArrowUp') this.input.forward = false;
            if (e.code === 'KeyS' || e.code === 'ArrowDown') this.input.backward = false;
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.input.left = false;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') this.input.right = false;
            if (e.code === 'Space') this.input.shoot = false;
        });

        // التحكم باللمس عبر الأزرار في HTML
        const setupButton = (id, key) => {
            const button = document.getElementById(id);
            button.addEventListener('touchstart', (e) => { e.preventDefault(); this.input[key] = true; }, { passive: false });
            button.addEventListener('touchend', (e) => { e.preventDefault(); this.input[key] = false; }, { passive: false });
            button.addEventListener('mousedown', (e) => { e.preventDefault(); this.input[key] = true; });
            button.addEventListener('mouseup', (e) => { e.preventDefault(); this.input[key] = false; });
            button.addEventListener('mouseleave', (e) => { this.input[key] = false; });
        };

        setupButton('btn-fwd', 'forward');
        setupButton('btn-bwd', 'backward');
        setupButton('btn-left', 'left');
        setupButton('btn-right', 'right');
    }

    // --- 7. حلقة التحديث الرئيسية ---
    update() {
        if (!this.simulation) return;

        // إرسال مدخلات اللاعب الحالي إلى السيرفر
        this.simulation.act({ type: 'INPUT', input: this.input });
        if (this.input.shoot) {
             this.input.shoot = false; // تطلق رصاصة واحدة مع كل ضغطة
        }

        const state = this.simulation.state;

        // تحديث كل سيارة في المشهد بناءً على الحالة من السيرفر
        Object.keys(state.cars).forEach(carId => {
            const carData = state.cars[carId];
            if (!this.cars.has(carId)) {
                // سيارة جديدة، قم بإنشائها
                const carMesh = this.createCarMesh(new THREE.Color(carData.color));
                this.scene.add(carMesh);
                this.cars.set(carId, carMesh);
                this.createHealthBar(carId);
            }

            const carMesh = this.cars.get(carId);
            if (carData.health <= 0) { // إخفاء السيارة إذا تم تدميرها
                carMesh.visible = false;
                this.healthBars.get(carId).container.style.display = 'none';
            } else {
                carMesh.visible = true;
                carMesh.position.set(carData.x, 0.5, carData.z);
                carMesh.rotation.y = carData.ry;
            }
        });
        
        // حذف السيارات التي خرجت من اللعبة
        this.cars.forEach((mesh, carId) => {
             if (!state.cars[carId]) {
                  this.scene.remove(mesh);
                  this.cars.delete(carId);
                  document.body.removeChild(this.healthBars.get(carId).container);
                  this.healthBars.delete(carId);
             }
        });

        // تحديث الرصاص
        Object.keys(state.bullets).forEach(bulletId => {
            const bulletData = state.bullets[bulletId];
            if (!this.bullets.has(bulletId)) {
                const geo = new THREE.SphereGeometry(0.15, 8, 8);
                const mat = new THREE.MeshBasicMaterial({color: 0xffff00});
                const bulletMesh = new THREE.Mesh(geo, mat);
                this.scene.add(bulletMesh);
                this.bullets.set(bulletId, bulletMesh);
            }
            const bulletMesh = this.bullets.get(bulletId);
            bulletMesh.position.set(bulletData.x, bulletData.y, bulletData.z);
        });

        // حذف الرصاص الذي اختفى
        this.bullets.forEach((mesh, bulletId) => {
            if(!state.bullets[bulletId]) {
                this.scene.remove(mesh);
                this.bullets.delete(bulletId);
            }
        });

        // تحديث الحاجز المتحرك
        this.movingBarrier.position.x = state.movingBarrier.x;
        this.movingBarrier.position.z = state.movingBarrier.z;

        // تحديث الكاميرا لتتبع سيارة اللاعب
        const myCarId = this.simulation.me.id;
        const myCarMesh = this.cars.get(myCarId);
        if (myCarMesh) {
            const offset = new THREE.Vector3(0, 5, -8); // مسافة الكاميرا خلف السيارة
            offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), myCarMesh.rotation.y);
            offset.add(myCarMesh.position);

            this.camera.position.lerp(offset, 0.1); // حركة كاميرا ناعمة
            this.camera.lookAt(myCarMesh.position);
        }
        
        // تحديث أشرطة الحياة
        this.updateHealthBars();

        // عرض المشهد
        this.renderer.render(this.scene, this.camera);
    }
}


// --- 6. إعداد محاكاة Multisynq (SharedSimulation) ---
// هذه الفئة تعمل على السيرفر (مجازياً) وتدير حالة اللعبة لكل اللاعبين.
class SharedSimulation {
    constructor() {
        this.state = {
            cars: {},
            bullets: {},
            movingBarrier: { x: 0, z: -50, dir: 1} // dir = 1 لليمين، -1 لليسار
        };
        this.bulletIndex = 0;
    }

    // يتم استدعاؤها عندما ينضم لاعب جديد
    onPlayerJoin(player) {
        // إنشاء سيارة جديدة للاعب
        this.state.cars[player.id] = new SimCar(player.id);
    }

    // يتم استدعاؤها عندما يغادر لاعب
    onPlayerLeave(player) {
        delete this.state.cars[player.id];
    }

    // يتم استدعاؤها عندما يرسل لاعب حركة أو حدث
    onPlayerAct(player, action) {
        if (action.type === 'INPUT') {
            const car = this.state.cars[player.id];
            if (car) {
                car.update(action.input, (bullet) => this.createBullet(bullet));
            }
        }
    }
    
    createBullet(bulletData) {
        const id = `bullet_${this.bulletIndex++}`;
        this.state.bullets[id] = bulletData;
        
        // حذف الرصاصة بعد فترة لتجنب تراكمها
        setTimeout(() => {
            delete this.state.bullets[id];
        }, 3000); // تبقى الرصاصة لـ 3 ثوانٍ
    }

    // يتم استدعاؤها بشكل دوري لتحديث حالة اللعبة (مثل حركة الأعداء أو العناصر التلقائية)
    tick() {
        // تحديث حركة الحاجز المتحرك
        const barrier = this.state.movingBarrier;
        barrier.x += 0.1 * barrier.dir;
        if (Math.abs(barrier.x) > 15) {
            barrier.dir *= -1; // عكس الاتجاه
        }
        
        // تحديث حركة الرصاص والتحقق من الاصطدامات
        Object.keys(this.state.bullets).forEach(bulletId => {
            const bullet = this.state.bullets[bulletId];
            if (!bullet) return;

            // تحديث موقع الرصاصة
            bullet.x += bullet.vx;
            bullet.y += bullet.vy;
            bullet.z += bullet.vz;
            
            // التحقق من الاصطدام بالسيارات الأخرى
            Object.keys(this.state.cars).forEach(carId => {
                const car = this.state.cars[carId];
                // لا يمكن للرصاصة أن تصيب مطلقها
                if (carId === bullet.ownerId || car.health <= 0) return;

                const distance = Math.sqrt(
                     Math.pow(bullet.x - car.x, 2) + 
                     Math.pow(bullet.z - car.z, 2)
                );

                if (distance < 1.5) { // تم الاصطدام
                    car.health -= 10; // إنقاص شريط الحياة
                    if(car.health < 0) car.health = 0;
                    delete this.state.bullets[bulletId]; // حذف الرصاصة
                }
            });
        });
    }
}

// فئة لتمثيل حالة السيارة الواحدة في المحاكاة
class SimCar {
    constructor(id) {
        this.id = id;
        this.x = Math.random() * 8 - 4; // موقع بداية عشوائي على الطريق
        this.z = 0;
        this.ry = 0; // زاوية الدوران
        this.color = `#${Math.floor(Math.random() * 16777215).toString(16)}`; // لون عشوائي
        this.health = 100; // شريط الحياة
        this.lastShotTime = 0; // لتحديد معدل إطلاق النار
    }

    update(input, createBulletCallback) {
        if (this.health <= 0) { // لا يمكن التحرك بعد التدمير
            // إعادة إحياء السيارة بعد 5 ثوانٍ
            setTimeout(() => {
                 this.health = 100;
                 this.x = Math.random() * 8 - 4;
                 this.z = 0;
                 this.ry = 0;
            }, 5000);
            return;
        }

        const direction = input.backward ? -1 : 1;
        if (input.left) this.ry += CAR_ROTATION_SPEED;
        if (input.right) this.ry -= CAR_ROTATION_SPEED;
        
        if (input.forward || input.backward) {
            this.x += Math.sin(this.ry) * CAR_SPEED * direction;
            this.z += Math.cos(this.ry) * CAR_SPEED * direction;
        }
        
        // التعامل مع إطلاق النار
        const now = Date.now();
        if (input.shoot && now - this.lastShotTime > 500) { // يمكن إطلاق رصاصة كل 0.5 ثانية
             this.lastShotTime = now;
             const bullet = {
                  ownerId: this.id,
                  x: this.x + Math.sin(this.ry) * 2,
                  y: 1.0, // ارتفاع إطلاق الرصاصة
                  z: this.z + Math.cos(this.ry) * 2,
                  vx: Math.sin(this.ry) * BULLET_SPEED,
                  vy: 0,
                  vz: Math.cos(this.ry) * BULLET_SPEED,
             };
             createBulletCallback(bullet);
        }
    }
}

// --- 7. الانضمام إلى جلسة اللعبة ---
Multisynq.Session.join({
    //هام: استبدل "YOUR_API_KEY_HERE" بمفتاح API الخاص بك من موقع multisynq.io
    apiKey: "2sIWGGhjzCxnD3q373pGGamKkD2Lw2TJkXObGlutOa",
    
    // اسم الجلسة، يجب أن يكون فريدًا لكل لعبة أو "غرفة"
    name: location.origin + location.pathname,
    password: "none", // كلمة مرور للجلسة (اختياري)
    
    model: SharedSimulation, // فئة إدارة حالة اللعبة
    view: SimInterface,      // فئة عرض اللعبة (Three.js)
    
    debug: ["writes"] // عرض رسائل التصحيح في الكونسول
}).then(app => {
    // app.view هو نسخة من SimInterface
    // app.model هو نسخة من SharedSimulation
    const view = app.view || app;

    // بدء حلقة اللعبة الرئيسية
    const loop = () => {
        view.update(); // استدعاء دالة التحديث في SimInterface
        requestAnimationFrame(loop);
    };
    loop();
}).catch(alert);

// --- CSS إضافي في JavaScript لأشرطة الحياة ---
const style = document.createElement('style');
style.innerHTML = `
    .health-bar-container {
        position: fixed;
        width: 60px;
        height: 8px;
        background-color: #555;
        border: 1px solid #000;
        border-radius: 4px;
        transform: translateX(-50%); /* لتوسيط الشريط فوق السيارة */
        display: none; /* يتم إظهاره عبر JS */
        pointer-events: none; /* تجاهل تفاعل الفأرة */
    }
    .health-bar-fill {
        width: 100%;
        height: 100%;
        background-color: green;
        border-radius: 3px;
        transition: width 0.2s, background-color 0.2s;
    }
`;
document.head.appendChild(style);