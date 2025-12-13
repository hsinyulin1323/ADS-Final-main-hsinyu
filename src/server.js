const express = require('express');
const neo4j = require('neo4j-driver');
const cors = require('cors');
const crypto = require('crypto');
const app = express();
app.use(cors()); // 允許前端 (React) 連線
app.use(express.json()); // 讓後端看得懂 JSON 格式的資料

// ---------------------------------------------------------
// 1. 設定資料庫連線
// ---------------------------------------------------------
// 請確認密碼是否正確
const driver = neo4j.driver(
  'neo4j://localhost:7687',
  neo4j.auth.basic('neo4j', 'HealthcareDBpw') 
);

// ---------------------------------------------------------
// 2. 定義 API (讓前端呼叫的功能)
// ---------------------------------------------------------

// 功能 A: 測試連線用
app.get('/', (req, res) => {
  res.send('後端伺服器運作中！');
});

// 功能 B: 取得所有醫生列表
app.get('/api/doctors', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run('MATCH (d:Doctor) RETURN d');
    const doctors = result.records.map(record => record.get('d').properties);
    res.json(doctors);
  } catch (error) {
    res.status(500).send(error.message);
  } finally {
    await session.close();
  }
});

// 功能 C: 取得所有病人列表
app.get('/api/patients', async (req, res) => {
    const session = driver.session();
    try {
      const result = await session.run('MATCH (p:Patient) RETURN p');
      const patients = result.records.map(record => record.get('p').properties);
      res.json(patients);
    } catch (error) {
      res.status(500).send(error.message);
    } finally {
      await session.close();
    }
});

// (已移除衝突的 功能 D，現在由下方的 功能 M 取代)

// 功能 E: 新增醫生
app.post('/api/doctors', async (req, res) => {
    const { name, id, status } = req.body;
    // 預設為 Available
    const finalStatus = ['Available', 'Busy', 'On Leave'].includes(status) ? status : 'Available';
    
    const session = driver.session();
    try {
        await session.run(
            `CREATE (d:Doctor {name: $name, id: $id, status: $finalStatus}) RETURN d`,
            { name, id, finalStatus }
        );
        res.json({ message: `醫生 ${name} 新增成功！` });
    } catch (error) {
        res.status(500).send(error.message);
    } finally {
        await session.close();
    }
});

// 功能 F: 修改醫生資料
app.put('/api/doctors/:targetId', async (req, res) => {
    const targetId = req.params.targetId;
    const { name, id, status } = req.body;
    const session = driver.session();
    try {
        const query = `
            MATCH (d:Doctor {id: $targetId})
            SET d.name = $name, d.id = $id, d.status = $status
            RETURN d
        `;
        await session.run(query, { targetId, name, id, status });
        res.json({ message: `醫生資料已更新！` });
    } catch (error) {
        res.status(500).send(error.message);
    } finally {
        await session.close();
    }
});

// 功能 G: 刪除醫生
app.delete('/api/doctors/:targetId', async (req, res) => {
	const targetId = req.params.targetId;
	const session = driver.session();
	try {
		const query = `MATCH (d:Doctor {id: $targetId}) DETACH DELETE d`;
		await session.run(query, { targetId });
		res.json({ message: `醫生 (ID: ${targetId}) 已刪除！` });
	} catch (error) {
		res.status(500).send(error.message);
	} finally {
		await session.close();
	}
});

// 功能 K: 尋找替代醫生 (加強版：包含車輛資訊)
app.get('/api/appointments/:appointmentId/alternatives', async (req, res) => {
    const { appointmentId } = req.params;
    const session = driver.session();

    try {
        const query = `
            MATCH (p:Patient)-[r1:HAS_APPOINTMENT]->(a:Appointment {id: $appointmentId})-[r2:ASSIGNED_TO]->(badDoc:Doctor)
            
            // 1. 篩選：只找狀態為 'Available' 的醫生 (排除 Busy 和 On Leave)
            MATCH (altDoc:Doctor {status: 'Available'})
            WHERE altDoc.id <> badDoc.id
            
            // 2. 評分機制 (Graph Algorithm 應用)
            // 曾經看過診 (Relationship: TREATED_BY) +5分
            OPTIONAL MATCH (p)-[rHistory:TREATED_BY]->(altDoc)
            
            // 判斷是否有車 (Relationship: HAS_CAR) +2分
            OPTIONAL MATCH (altDoc)-[rCar:HAS_CAR]->(car:Car {status: 'Available'})
            
            WITH p, a, badDoc, altDoc, car, rHistory,
                 (CASE WHEN rHistory IS NOT NULL THEN 5 ELSE 0 END + 
                  CASE WHEN car IS NOT NULL THEN 2 ELSE 0 END) AS score
            
            // 依分數排序
            ORDER BY score DESC
            LIMIT 5
            
            RETURN p, a, badDoc, altDoc, car, score, rHistory
        `;
        
        const result = await session.run(query, { appointmentId });
        
        // 整理給前端 ForceGraph2D 用的資料
        let nodes = [];
        let links = [];
        const addedNodeIds = new Set();
        
        // 輔助函式：避免重複加節點
        const addNode = (node, group, labelKey = 'name') => {
            if (!node) return null;
            if (!addedNodeIds.has(node.elementId)) {
                nodes.push({ 
                    id: node.elementId, 
                    label: node.properties[labelKey] || node.properties.id, 
                    group: group, 
                    ...node.properties 
                });
                addedNodeIds.add(node.elementId);
            }
            return node.elementId;
        };

        let original = null;
        let alternativesList = [];

        result.records.forEach(record => {
            const pId = addNode(record.get('p'), 'Patient');
            const aId = addNode(record.get('a'), 'Appointment', 'time'); // 顯示時間
            const badId = addNode(record.get('badDoc'), 'DoctorBusy');
            const altId = addNode(record.get('altDoc'), 'DoctorAvailable');
            const carId = addNode(record.get('car'), 'Car');

            // 建立連結
            links.push({ source: pId, target: aId, label: 'HAS_APPOINTMENT' });
            links.push({ source: aId, target: badId, label: 'ORIGINAL' }); // 原本的醫生
            
            // 替代醫生的連結 (如果有看診紀錄，線條顏色不同)
            if (record.get('rHistory')) {
                links.push({ source: pId, target: altId, label: 'TREATED_BY', color: '#FFD700', value: 2 });
            } else {
                links.push({ source: aId, target: altId, label: 'SUGGESTED', lineDash: [5, 5] });
            }

            if (carId) {
                links.push({ source: altId, target: carId, label: 'DRIVES' });
            }

            original = record.get('badDoc').properties;
            alternativesList.push({
                ...record.get('altDoc').properties,
                score: record.get('score').low // Neo4j Integer 轉 JS
            });
        });

        const uniqueLinks = [...new Set(links.map(JSON.stringify))].map(JSON.parse);
        
        res.json({ 
            graph: { nodes, links: uniqueLinks },
            info: { original_doctor: original, alternatives: alternativesList }
        });

    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    } finally {
        await session.close();
    }
});

// 功能 L: 尋找備援巡邏車
app.get('/api/cars/backup', async (req, res) => {
	const session = driver.session();
	try {
		const query = `MATCH (c:Car {status: 'Available'}) RETURN c`;
		const result = await session.run(query);
		const cars = result.records.map(record => record.get('c').properties);
		res.json({ available_cars: cars, count: cars.length });
	} catch (error) {
		res.status(500).send(error.message);
	} finally {
		await session.close();
	}
});

// ==========================================
// 修改功能 M: 建立新預約 (自動產生 ID + 支援 Duration)
// ==========================================
app.post('/api/appointments', async (req, res) => {
    // 1. 移除 req.body 中的 appointId，改由後端產生
    const { patientId, doctorId, time, duration } = req.body;
    const session = driver.session();
    
    // 2. 自動產生 ID (例如: APP1702345678900)
    const appointId = `APP${Date.now()}`; 

    try {
        const query = `
            MATCH (p:Patient {id: $patientId})
            MATCH (d:Doctor {id: $doctorId})
            CREATE (a:Appointment {
                id: $appointId,
                time: $time,
                duration: $duration,  // 儲存看診時間
                status: 'Pending'
            })
            CREATE (p)-[:HAS_APPOINTMENT]->(a)
            CREATE (a)-[:ASSIGNED_TO]->(d)
            RETURN a
        `;
        
        // 若前端沒傳 duration，預設給 30 分鐘
        await session.run(query, { 
            patientId, 
            doctorId, 
            time, 
            appointId, 
            duration: parseInt(duration) || 30 
        });
        
        res.json({ message: `預約建立成功！單號: ${appointId}` });
    } catch (error) {
        console.error("建立預約失敗:", error);
        res.status(500).send("建立失敗: " + error.message);
    } finally {
        await session.close();
    }
});

// ==========================================
// 輔助函式：呼叫 OSRM 計算真實行車時間 (單位：分鐘)
// ==========================================
const getTravelTimeOSRM = async (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    
    // 使用 OSRM 公共 Demo Server (注意：請勿用於商業高頻請求)
    const url = `http://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    
    try {
        // 使用 Node.js 內建 fetch (Node 18+)
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            // duration 是秒，轉為分鐘 (無條件進位)
            return Math.ceil(data.routes[0].duration / 60);
        }
        return 999; // 如果路徑計算失敗，回傳大數值避免錯誤排程
    } catch (error) {
        console.error("OSRM Error:", error.message);
        return 30; // 發生網路錯誤時的保守估計值 (Fallback)
    }
};

// ==========================================
// 功能 R-2: 智慧推薦醫生 (真實導航版)
// ==========================================
app.post('/api/find-available-doctors', async (req, res) => {
    const { patientId, newTime, newDuration } = req.body;
    const session = driver.session();

    try {
        // 1. 取得目標病人位置
        const pResult = await session.run(`MATCH (p:Patient {id: $patientId}) RETURN p`, { patientId });
        if (pResult.records.length === 0) return res.status(404).json({ message: "病人不存在" });
        
        const targetP = pResult.records[0].get('p').properties;
        
        // 時間處理: "10:00" -> 600 分鐘
        const toMins = (t) => {
            if(!t || !t.includes(':')) return 0;
            const parts = t.split(' ')[1] ? t.split(' ')[1].split(':') : t.split(':');
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        };
        const newStart = toMins(newTime);
        const newEnd = newStart + parseInt(newDuration || 30);

        // 2. 取得所有醫生及其當日行程 (按時間排序)
        // 這裡一次抓取所有資料，在 JS 層進行複雜的 API 呼叫
        const docResult = await session.run(`
            MATCH (d:Doctor)
            OPTIONAL MATCH (d)<-[:ASSIGNED_TO]-(a:Appointment)<-[:HAS_APPOINTMENT]-(p:Patient)
            WITH d, a, p ORDER BY a.time ASC
            WITH d, collect({time: a.time, duration: a.duration, lat: p.lat, lng: p.lng}) as schedule
            RETURN d.id as id, d.name as name, d.status as status, schedule
        `);

        const availableDoctors = [];

        // 3. 對每位醫生進行可行性分析
        for (const record of docResult.records) {
            const docId = record.get('id');
            const docName = record.get('name');
            const status = record.get('status');
            const schedule = record.get('schedule').filter(s => s.time !== null); // 過濾掉沒有預約的空列

            // 如果醫生狀態是 Busy 且我們無法判斷何時結束，這裡可選擇直接跳過，或僅依賴 Schedule
            // 這裡假設 status 僅供參考，主要依據 schedule 判斷
            
            let isFeasible = true;
            let travelTimeFromPrev = 0;

            // 尋找插入點
            // 我們需要檢查新預約是否會跟 "前一個預約" 或 "後一個預約" 衝突
            // 衝突定義：時間重疊 OR 交通時間不足
            
            for (let i = 0; i <= schedule.length; i++) {
                const prevAppt = i > 0 ? schedule[i - 1] : null;
                const nextAppt = i < schedule.length ? schedule[i] : null;

                // 判斷新預約是否落在 prev 和 next 之間的時間空檔
                const prevEnd = prevAppt ? toMins(prevAppt.time) + parseInt(prevAppt.duration || 30) : -Infinity;
                const nextStart = nextAppt ? toMins(nextAppt.time) : Infinity;

                // 如果新預約的時間段完全落在這個區間內 (暫不考慮交通)
                if (newStart >= prevEnd && newEnd <= nextStart) {
                    // 進一步檢查：加上真實交通時間是否還來得及？
                    
                    let timeFromPrev = 0; // 從上一場趕過來的時間
                    let timeToNext = 0;   // 趕去下一場的時間

                    // 1. 檢查與上一場的交通
                    if (prevAppt) {
                        timeFromPrev = await getTravelTimeOSRM(prevAppt.lat, prevAppt.lng, targetP.lat, targetP.lng);
                    }

                    // 2. 檢查與下一場的交通
                    if (nextAppt) {
                        timeToNext = await getTravelTimeOSRM(targetP.lat, targetP.lng, nextAppt.lat, nextAppt.lng);
                    }

                    // 3. 嚴格判定
                    // 上一場結束時間 + 車程 <= 新開始時間
                    const condition1 = (prevEnd + timeFromPrev) <= newStart;
                    // 新結束時間 + 車程 <= 下一場開始時間
                    const condition2 = (newEnd + timeToNext) <= nextStart;

                    if (condition1 && condition2) {
                        // 找到可行空檔！加入名單
                        availableDoctors.push({
                            id: docId,
                            name: docName,
                            travelTime: timeFromPrev // 顯示醫生要花多久過來
                        });
                        break; // 這位醫生可以，不用再檢查他的其他時段
                    }
                }
            }
        }

        // 依據「醫生趕過來的時間」由短到長排序
        availableDoctors.sort((a, b) => a.travelTime - b.travelTime);

        res.json(availableDoctors);

    } catch (error) {
        console.error("Recommendation Error:", error);
        res.status(500).send(error.message);
    } finally {
        await session.close();
    }
});

// 1. 修改功能 N: 取得所有預約 (增加 return p.location)
app.get('/api/appointments', async (req, res) => {
    const session = driver.session();
    try {
        const query = `
            MATCH (a:Appointment)
            OPTIONAL MATCH (p:Patient)-[:HAS_APPOINTMENT]->(a)
            OPTIONAL MATCH (a)-[:ASSIGNED_TO]->(d:Doctor)
            // 🌟 新增 p.location
            RETURN a, p, d, p.location as location 
            ORDER BY a.time ASC
        `;
        const result = await session.run(query);
        const appointments = result.records.map(record => {
            const a = record.get('a').properties;
            const p = record.get('p') ? record.get('p').properties : { name: "Unknown", id: "" };
            const d = record.get('d') ? record.get('d').properties : { name: "Unassigned", id: "" };
            
            return { 
                id: a.id, 
                time: a.time, 
                status: a.status,
                patientName: p.name,
                doctorName: d.name,
                doctorId: d.id,
                patientId: p.id,
                location: record.get('location') || "無地址" // 🌟 這裡回傳地點
            };
        });
        res.json(appointments);
    } catch (error) {
        console.error("讀取預約失敗:", error);
        res.status(500).send(error.message);
    } finally {
        await session.close();
    }
});

// 功能 O: 刪除預約 (以及相關的關係)
app.delete('/api/appointments/:appointId', async (req, res) => {
    const { appointId } = req.params;
    const session = driver.session();
    try {
        await session.run(`MATCH (a:Appointment {id: $appointId}) DETACH DELETE a`, { appointId });
        res.json({ message: `預約 ${appointId} 已刪除` });
    } catch (error) {
        res.status(500).send(error.message);
    } finally {
        await session.close();
    }
});

// 2. 修改功能 P: 取得醫生的最佳路徑 (加入車輛位置作為起點)
app.get('/api/route/:doctorId', async (req, res) => {
    const { doctorId } = req.params;
    const session = driver.session();
    try {
        // 🌟 修改查詢：同時抓取醫生綁定的車輛 (c)
        const query = `
            MATCH (d:Doctor {id: $doctorId})
            // 1. 抓取該醫生的車子 (Optional 以防醫生沒車時不會報錯)
            OPTIONAL MATCH (d)-[:HAS_CAR]->(c:Car)
            
            // 2. 抓取預約與病人
            OPTIONAL MATCH (d)<-[:ASSIGNED_TO]-(a:Appointment)<-[:HAS_APPOINTMENT]-(p:Patient)
            WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
            
            RETURN c, p.name as patient, p.lat as lat, p.lng as lng, a.time as time
            ORDER BY a.time ASC
        `;
        const result = await session.run(query, { doctorId });
        
        // 加入這段 Debug 程式碼
        if (result.records.length > 0) {
            const firstRecord = result.records[0];
            const car = firstRecord.get('c');
            console.log("=== Debug: Car Info ===");
            console.log("Found Records:", result.records.length);
            console.log("Car Node:", car); // 看看這裡是 null 還是物件
            if (car) {
                console.log("Car Properties:", car.properties); // 檢查是否有 lat, lng
            }
        } else {
            console.log("=== Debug: No Records Found ===");
        }

        let route = [];

        // 3. 處理結果：先放入車子當作起點 (如果有車的話)
        if (result.records.length > 0) {
            const carNode = result.records[0].get('c');
            if (carNode && carNode.properties.lat && carNode.properties.lng) {
                route.push({
                    type: 'Car', // 標記類型
                    name: 'Current Location (Car)',
                    lat: carNode.properties.lat,
                    lng: carNode.properties.lng,
                    time: 'Now'
                });
            }
        }

        // 4. 放入病人的點
        result.records.forEach(record => {
            if (record.get('lat') && record.get('lng')) {
                route.push({
                    type: 'Patient', // 標記類型
                    name: record.get('patient'),
                    lat: record.get('lat'),
                    lng: record.get('lng'),
                    time: record.get('time')
                });
            }
        });
        
        res.json(route);
    } catch (error) {
        res.status(500).send(error.message);
    } finally {
        await session.close();
    }
});

// =========================================================
// ✅ NEW: Appointment Requests (date + AM/PM slot + symptoms)
// =========================================================

// 建立病人預約請求（PENDING, 無精確 time / doctor）
app.post("/api/appointment-requests", async (req, res) => {
  const session = driver.session();

  try {
    const { patientId, patientName, date, timeSlot, subject, symptoms } = req.body || {};

    if (!patientId || !patientName || !date || !timeSlot || !subject || !symptoms) {
      return res.status(400).json({
        message: "Missing fields. Required: patientId, patientName, date, timeSlot, subject, symptoms",
      });
    }

    const normalizedId = String(patientId).trim().toUpperCase();
    const normalizedName = String(patientName).trim();
    const normalizedSlot = String(timeSlot).trim().toUpperCase(); // AM / PM

    if (!/^[A-Z][0-9]{9}$/.test(normalizedId)) {
      return res.status(400).json({ message: "Invalid patientId format (TW ID). Example: B200000000" });
    }
    if (!["AM", "PM"].includes(normalizedSlot)) {
      return res.status(400).json({ message: "Invalid timeSlot. Use AM or PM." });
    }

    // 產生 request id
    const requestId = `REQ${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const query = `
      MERGE (p:Patient {id: $patientId})
      ON CREATE SET p.name = $patientName
      // ON MATCH 不覆蓋既有病人資料（rhesus/blood_type/age/contact 等）
      CREATE (r:AppointmentRequest {
        id: $requestId,
        date: $date,
        timeSlot: $timeSlot,
        subject: $subject,
        symptoms: $symptoms,
        status: 'PENDING',
        createdAt: datetime()
      })
      CREATE (p)-[:REQUESTED_APPOINTMENT]->(r)
      RETURN r, p
    `;

    const result = await session.run(query, {
      requestId,
      patientId: normalizedId,
      patientName: normalizedName,
      date: String(date),
      timeSlot: normalizedSlot,
      subject: String(subject),
      symptoms: String(symptoms),
    });

    const r = result.records[0].get("r").properties;
    const p = result.records[0].get("p").properties;

    return res.json({
      message: `Appointment request created: ${r.id}`,
      request: r,
      patient: p,
    });
  } catch (error) {
    console.error("Create appointment request failed:", error);
    return res.status(500).send(error.message);
  } finally {
    await session.close();
  }
});

// 查詢預約請求（可用 query: ?patientId=B200000000 或 ?status=PENDING）
app.get("/api/appointment-requests", async (req, res) => {
  const session = driver.session();

  try {
    const patientId = req.query.patientId ? String(req.query.patientId).trim().toUpperCase() : "";
    const status = req.query.status ? String(req.query.status).trim().toUpperCase() : "";

    const query = `
      MATCH (p:Patient)-[:REQUESTED_APPOINTMENT]->(r:AppointmentRequest)
      ${patientId ? "WHERE p.id = $patientId" : ""}
      ${status ? (patientId ? "AND r.status = $status" : "WHERE r.status = $status") : ""}
      RETURN r, p
      ORDER BY r.createdAt DESC
    `;

    const result = await session.run(query, {
      patientId: patientId || undefined,
      status: status || undefined,
    });

    const rows = result.records.map((rec) => {
      const r = rec.get("r").properties;
      const p = rec.get("p").properties;

      return {
        id: r.id,
        status: r.status,
        date: r.date,
        timeSlot: r.timeSlot,
        subject: r.subject,
        symptoms: r.symptoms,
        createdAt: r.createdAt,
        patient: {
          id: p.id,
          name: p.name,
          age: p.age,
          blood_type: p.blood_type,
          rhesus: p.rhesus,
          contact: p.contact,
          location: p.location, // 你資料若有
        },
      };
    });

    return res.json(rows);
  } catch (error) {
    console.error("Query appointment requests failed:", error);
    return res.status(500).send(error.message);
  } finally {
    await session.close();
  }
});

// 刪除預約請求（病人取消 / 醫生已排定後刪）
app.delete("/api/appointment-requests/:requestId", async (req, res) => {
  const session = driver.session();
  try {
    const requestId = String(req.params.requestId || "").trim();
    if (!requestId) return res.status(400).json({ message: "Missing requestId" });

    await session.run(
      `
      MATCH (r:AppointmentRequest {id: $requestId})
      DETACH DELETE r
      `,
      { requestId }
    );

    return res.json({ message: `Appointment request ${requestId} deleted` });
  } catch (error) {
    console.error("Delete appointment request failed:", error);
    return res.status(500).send(error.message);
  } finally {
    await session.close();
  }
});

// 功能 Q: 修改預約內容 (更新時間、醫生或病人)
app.put('/api/appointments/:appointId', async (req, res) => {
    const { appointId } = req.params;
    const { patientId, doctorId, time } = req.body;
    const session = driver.session();

    try {
        const query = `
            MATCH (a:Appointment {id: $appointId})
            // 1. 刪除舊的關係 (因為可能換醫生或病人)
            OPTIONAL MATCH (a)-[r1:ASSIGNED_TO]->()
            OPTIONAL MATCH ()-[r2:HAS_APPOINTMENT]->(a)
            DELETE r1, r2
            
            // 2. 更新時間
            SET a.time = $time
            
            // 3. 重新建立關係 (必須找到新的病人與醫生)
            WITH a
            MATCH (p:Patient {id: $patientId})
            MATCH (d:Doctor {id: $doctorId})
            CREATE (p)-[:HAS_APPOINTMENT]->(a)
            CREATE (a)-[:ASSIGNED_TO]->(d)
            RETURN a
        `;
        
        await session.run(query, { appointId, patientId, doctorId, time });
        res.json({ message: `預約 ${appointId} 更新成功！` });
    } catch (error) {
        console.error("更新預約失敗:", error);
        res.status(500).send(error.message);
    } finally {
        await session.close();
    }
});

// ==========================================
// 新增功能 R: 進階衝突檢測 (含交通時間)
// ==========================================
app.post('/api/check-availability', async (req, res) => {
    const { doctorId, patientId, newTime, newDuration } = req.body;
    const session = driver.session();

    try {
        // 0. 先檢查醫生狀態 (新增的邏輯)
        const docResult = await session.run(`MATCH (d:Doctor {id: $doctorId}) RETURN d.status as status`, { doctorId });
        if (docResult.records.length === 0) return res.json({ available: false, reason: "醫生不存在" });
        
        const currentStatus = docResult.records[0].get('status');
        
        // 這裡實作你的需求：狀態若是 On Leave 或 Busy，直接擋下
        if (currentStatus === 'On Leave') return res.json({ available: false, reason: "醫生休假中 (On Leave)" });
        if (currentStatus === 'Busy') return res.json({ available: false, reason: "醫生目前狀態為 Busy，不接受預約" });

        // ... (以下維持原有的時間與距離計算邏輯，完全不用動) ...
        // 1. 抓取該醫生當天所有行程
        const querySchedule = `
            MATCH (d:Doctor {id: $doctorId})<-[:ASSIGNED_TO]-(a:Appointment)<-[:HAS_APPOINTMENT]-(p:Patient)
            RETURN a.time as time, a.duration as duration, p.lat as lat, p.lng as lng
        `;
        // ... (中間省略，請保留原本 server.js 裡面的 OSRM/時間計算代碼) ...
        // ... (直到最後 res.json) ...
        
        // --- 為了讓你方便複製，這裡補上後半段的核心邏輯 ---
        const resultSchedule = await session.run(querySchedule, { doctorId });
        const appointments = resultSchedule.records.map(r => ({
            time: r.get('time'),       
            duration: r.get('duration') || 30, 
            lat: r.get('lat'),
            lng: r.get('lng')
        }));

        const queryTarget = `MATCH (p:Patient {id: $patientId}) RETURN p.lat as lat, p.lng as lng`;
        const resultTarget = await session.run(queryTarget, { patientId });
        if (resultTarget.records.length === 0) return res.json({ available: false, reason: "找不到該病人 ID" });
        
        const targetP = resultTarget.records[0];
        const targetLat = targetP.get('lat');
        const targetLng = targetP.get('lng');

        const toMins = (t) => {
            if(!t || !t.includes(':')) return 0;
            const parts = t.split(' ')[1] ? t.split(' ')[1].split(':') : t.split(':');
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        };
        const newStart = toMins(newTime);
        const newEnd = newStart + parseInt(newDuration || 30);

        const getDistKm = (lat1, lng1, lat2, lng2) => {
            if(!lat1 || !lat2) return 0;
            const R = 6371; 
            const dLat = (lat2-lat1) * Math.PI/180;
            const dLon = (lng2-lng1) * Math.PI/180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        };

        let conflict = false;
        let conflictReason = "";

        for (const appt of appointments) {
            const existStart = toMins(appt.time);
            const existEnd = existStart + parseInt(appt.duration);
            const dist = getDistKm(targetLat, targetLng, appt.lat, appt.lng);
            const travelTime = Math.ceil(dist / 0.67); 
            const safeStart = existStart - travelTime; 
            const safeEnd = existEnd + travelTime;     
            
            if (newStart < safeEnd && newEnd > safeStart) {
                conflict = true;
                conflictReason = `時間衝突！需預留 ${travelTime} 分鐘車程。`;
                break;
            }
        }
        res.json({ available: !conflict, reason: conflictReason });

    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    } finally {
        await session.close();
    }
});

// 功能 S: 視覺化醫生的預約鏈 (Sequence of Care)
app.get('/api/doctor-chain/:doctorId', async (req, res) => {
    const { doctorId } = req.params;
    const session = driver.session();
    try {
        // 找出該醫生所有的預約，並依照時間排序
        const query = `
            MATCH (d:Doctor {id: $doctorId})<-[:ASSIGNED_TO]-(a:Appointment)<-[:HAS_APPOINTMENT]-(p:Patient)
            WITH d, a, p ORDER BY a.time ASC
            RETURN d, collect({appt: a, patient: p}) AS schedule
        `;
        const result = await session.run(query, { doctorId });
        
        let nodes = [];
        let links = [];
        
        if(result.records.length > 0) {
            const rec = result.records[0];
            const d = rec.get('d');
            const schedule = rec.get('schedule');
            
            // 1. 醫生節點 (中心)
            nodes.push({ id: d.elementId, label: d.properties.name, group: 'Doctor' });
            
            let prevNodeId = d.elementId;
            
            // 2. 依序連接病人
            schedule.forEach((item, index) => {
                const appt = item.appt.properties;
                const p = item.patient;
                
                // 病人節點
                const pNodeId = p.elementId;
                // 檢查重複 (雖然同一病人可能看兩次，但 ID 是一樣的，ForceGraph 會處理)
                if (!nodes.find(n => n.id === pNodeId)) {
                    nodes.push({ 
                        id: pNodeId, 
                        label: `${p.properties.name} (${appt.time})`, 
                        group: 'Patient' 
                    });
                }

                // 建立有向連結: 醫生 -> 病人1 -> 病人2 ...
                links.push({
                    source: prevNodeId,
                    target: pNodeId,
                    label: index === 0 ? 'START' : 'NEXT',
                    val: 5 // 線條粗細
                });
                
                prevNodeId = pNodeId;
            });
        }

        res.json({ nodes, links });
    } catch (e) {
        console.error(e);
        res.status(500).send(e.message);
    } finally {
        await session.close();
    }
});

// ---------------------------------------------------------
// 3. 啟動伺服器
// ---------------------------------------------------------
const PORT = 5001; 
app.listen(PORT, () => {
  console.log(`後端伺服器已經啟動，網址是: http://localhost:${PORT}`);
});