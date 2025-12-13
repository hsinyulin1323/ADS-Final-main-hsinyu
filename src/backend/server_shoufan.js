const express = require('express');
const neo4j = require('neo4j-driver');
const cors = require('cors');
const app = express();

app.use(cors()); 
app.use(express.json()); 

// ---------------------------------------------------------
// 硬編碼的病人地址資料庫
// ---------------------------------------------------------
const PATIENT_LOCATIONS = {
    'B111111111': { address: '臺中市中區綠川西街73號', lat: 24.138260, lng: 120.684192 },
    'B222222222': { address: '臺中市西區公益路68號', lat: 24.151943, lng: 120.664182 },
    'B133333333': { address: '臺中市南屯區文心南三路289號', lat: 24.132826, lng: 120.649256 },
    'B244444444': { address: '臺中市南屯區向上路二段168號4樓', lat: 24.148559, lng: 120.646890 },
    'B155555555': { address: '臺中市南屯區文心南路511號', lat: 24.124327, lng: 120.648994 },
    'B266666666': { address: '臺中市西屯區中清路二段189巷57號', lat: 24.177206, lng: 120.668013 },
    'B177777777': { address: '臺中市北區崇德路一段55號', lat: 24.157793, lng: 120.685618 },
    'B288888888': { address: '臺中市北區忠明路499號', lat: 24.163232, lng: 120.672338 },
    'B199999999': { address: '臺中市西屯區惠來路二段101號', lat: 24.163199, lng: 120.641905 },
    'B200000000': { address: '臺中市南屯區黎明路二段503號', lat: 24.155306, lng: 120.634099 }
};

const getLocation = (id) => {
    return PATIENT_LOCATIONS[id] || { address: '未知地址', lat: 24.137, lng: 120.686 };
};

// ---------------------------------------------------------
// 資料庫連線
// ---------------------------------------------------------
const driver = neo4j.driver(
  'neo4j://localhost:7687',
  neo4j.auth.basic('neo4j', 'HealthcareDBpw') 
);

// ---------------------------------------------------------
// API 路由
// ---------------------------------------------------------

app.get('/', (req, res) => {
  res.send('Backend Server is running.');
});

// 1. 取得所有醫生
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

// 2. 取得所有病人
app.get('/api/patients', async (req, res) => {
    const session = driver.session();
    try {
        const result = await session.run('MATCH (p:Patient) RETURN p ORDER BY p.id');
        const patients = result.records.map(record => {
            const p = record.get('p').properties;
            const loc = getLocation(p.id);

            return {
                id: p.id,
                name: p.name,
                age: p.age && p.age.low !== undefined ? p.age.low : p.age, 
                blood_type: p.blood_type,
                rhesus: p.rhesus,
                address: loc.address 
            };
        });
        res.json(patients);
    } catch (error) {
        res.status(500).send(error.message);
    } finally {
        await session.close();
    }
});

// 3. 新增醫生
app.post('/api/doctors', async (req, res) => {
    const { name, id } = req.body;
    const session = driver.session();
    try {
        await session.run(
            `CREATE (d:Doctor {name: $name, id: $id}) RETURN d`,
            { name, id }
        );
        res.json({ message: `Doctor ${name} added successfully.` });
    } catch (error) {
        res.status(500).send(error.message);
    } finally {
        await session.close();
    }
});

// 4. 修改醫生資料
app.put('/api/doctors/:targetId', async (req, res) => {
    const targetId = req.params.targetId;
    const { name, id } = req.body;
    const session = driver.session();
    try {
        await session.run(
            `MATCH (d:Doctor {id: $targetId}) SET d.name = $name, d.id = $id RETURN d`,
            { targetId, name, id }
        );
        res.json({ message: `Doctor info updated.` });
    } catch (error) {
        res.status(500).send(error.message);
    } finally {
        await session.close();
    }
});

// 5. 刪除醫生
app.delete('/api/doctors/:targetId', async (req, res) => {
	const targetId = req.params.targetId;
	const session = driver.session();
	try {
		await session.run(`MATCH (d:Doctor {id: $targetId}) DETACH DELETE d`, { targetId });
		res.json({ message: `Doctor ${targetId} deleted.` });
	} catch (error) {
		res.status(500).send(error.message);
	} finally {
		await session.close();
	}
});

// ==========================================
// 建立新預約 (包含 OSRM 交通衝突檢查)
// ==========================================
app.post('/api/appointments', async (req, res) => {
    const { patientId, doctorId, time, duration, caseDetails, address } = req.body;

    if (!patientId || !time) {
        return res.status(400).json({ message: "Error: Missing patient or time." });
    }

    const session = driver.session();
    const appointId = `APP${Date.now()}`;
    const newDuration = parseInt(duration) || 30;
    const BUFFER_TIME = 5; 

    const newLoc = getLocation(patientId);
    const addressToSave = address || newLoc.address;

    const toMins = (t) => {
        if (!t || !t.includes(':')) return 0;
        const parts = t.split(' ')[1] ? t.split(' ')[1].split(':') : t.split(':');
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    };

    try {
        const newStart = toMins(time);
        const newEnd = newStart + newDuration;

        if (doctorId) {
            const scheduleQuery = `
                MATCH (d:Doctor {id: $doctorId})<-[:ASSIGNED_TO]-(a:Appointment)<-[:HAS_APPOINTMENT]-(p:Patient)
                WHERE a.status <> 'Cancelled'
                RETURN a.time as time, a.duration as duration, p.id as pid
                ORDER BY a.time ASC
            `;
            const result = await session.run(scheduleQuery, { doctorId });
            
            const schedule = result.records.map(r => ({
                start: toMins(r.get('time')),
                end: toMins(r.get('time')) + (parseInt(r.get('duration')) || 30),
                loc: getLocation(r.get('pid')), 
                pid: r.get('pid')
            }));

            for (let i = 0; i < schedule.length; i++) {
                const exist = schedule[i];

                if (newStart < exist.end && newEnd > exist.start) {
                    return res.status(400).json({ message: `Failed: Time overlap with existing appointment.` });
                }

                if (newStart >= exist.end) {
                    const isPrev = (i === schedule.length - 1) || (schedule[i+1].start > newStart);
                    if (isPrev) {
                        const osrmTime = await getTravelTimeOSRM(exist.loc.lat, exist.loc.lng, newLoc.lat, newLoc.lng);
                        if (newStart < (exist.end + osrmTime + BUFFER_TIME)) {
                            return res.status(400).json({ message: `Failed: Not enough travel time from previous patient (${osrmTime} min needed).` });
                        }
                    }
                }

                if (newEnd <= exist.start) {
                    const isNext = (i === 0) || (schedule[i-1].end < newStart);
                    if (isNext) {
                        const osrmTime = await getTravelTimeOSRM(newLoc.lat, newLoc.lng, exist.loc.lat, exist.loc.lng);
                        if ((newEnd + osrmTime + BUFFER_TIME) > exist.start) {
                            return res.status(400).json({ message: `Failed: Will cause delay for next patient (${osrmTime} min needed).` });
                        }
                    }
                }
            }
        }

        const patConflictQuery = `
            MATCH (p:Patient {id: $patientId})-[:HAS_APPOINTMENT]->(a:Appointment)
            WHERE a.time = $time AND a.status <> 'Cancelled'
            RETURN p
        `;
        const patConflict = await session.run(patConflictQuery, { patientId, time });
        if (patConflict.records.length > 0) {
            return res.status(400).json({ message: `Failed: Patient already has an appointment at this time.` });
        }

        const query = `
            MATCH (p:Patient {id: $patientId})
            MATCH (d:Doctor {id: $doctorId})
            CREATE (a:Appointment {
                id: $appointId,
                time: $time,
                duration: $duration,
                status: 'Pending',
                address: $address,
                caseDetails: $caseDetails
            })
            CREATE (p)-[:HAS_APPOINTMENT]->(a)
            CREATE (a)-[:ASSIGNED_TO]->(d)
            RETURN a
        `;
        
        await session.run(query, { 
            patientId, 
            doctorId, 
            time, 
            appointId, 
            duration: newDuration,
            address: addressToSave,
            caseDetails: caseDetails || "無特殊註記"
        });
        
        res.json({ message: `Appointment created! ID: ${appointId}` });

    } catch (error) {
        console.error("Create Appt Error:", error);
        res.status(500).json({ message: "System Error: " + error.message });
    } finally {
        await session.close();
    }
});

// OSRM 交通時間計算
const getTravelTimeOSRM = async (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const url = `http://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            return Math.ceil(data.routes[0].duration / 60);
        }
        return 999; 
    } catch (error) {
        return 30;
    }
};

// 6. 尋找可用醫生
app.post('/api/find-available-doctors', async (req, res) => {
    const { patientId, newTime, newDuration } = req.body;
    const session = driver.session();

    try {
        const targetLoc = getLocation(patientId);
        const toMins = (t) => {
            if(!t || !t.includes(':')) return 0;
            const parts = t.split(' ')[1] ? t.split(' ')[1].split(':') : t.split(':');
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        };
        const newStart = toMins(newTime);
        const newEnd = newStart + parseInt(newDuration || 30);

        const docResult = await session.run(`
            MATCH (d:Doctor)
            OPTIONAL MATCH (d)<-[:ASSIGNED_TO]-(a:Appointment)<-[:HAS_APPOINTMENT]-(p:Patient)
            WITH d, a, p ORDER BY a.time ASC
            WITH d, collect({time: a.time, duration: a.duration, pid: p.id}) as schedule
            RETURN d.id as id, d.name as name, schedule
        `);

        const availableDoctors = [];

        for (const record of docResult.records) {
            const docId = record.get('id');
            const docName = record.get('name');
            const schedule = record.get('schedule').filter(s => s.time !== null); 

            for (let i = 0; i <= schedule.length; i++) {
                const prevAppt = i > 0 ? schedule[i - 1] : null;
                const nextAppt = i < schedule.length ? schedule[i] : null;

                const prevEnd = prevAppt ? toMins(prevAppt.time) + parseInt(prevAppt.duration || 30) : -Infinity;
                const nextStart = nextAppt ? toMins(nextAppt.time) : Infinity;

                if (newStart >= prevEnd && newEnd <= nextStart) {
                    let timeFromPrev = 0;
                    let timeToNext = 0;

                    if (prevAppt) {
                        const prevLoc = getLocation(prevAppt.pid);
                        timeFromPrev = await getTravelTimeOSRM(prevLoc.lat, prevLoc.lng, targetLoc.lat, targetLoc.lng);
                    }
                    if (nextAppt) {
                        const nextLoc = getLocation(nextAppt.pid);
                        timeToNext = await getTravelTimeOSRM(targetLoc.lat, targetLoc.lng, nextLoc.lat, nextLoc.lng);
                    }

                    const condition1 = (prevEnd + timeFromPrev) <= newStart;
                    const condition2 = (newEnd + timeToNext) <= nextStart;

                    if (condition1 && condition2) {
                        availableDoctors.push({
                            id: docId,
                            name: docName,
                            travelTime: timeFromPrev 
                        });
                        break; 
                    }
                }
            }
        }
        availableDoctors.sort((a, b) => a.travelTime - b.travelTime);
        res.json(availableDoctors);

    } catch (error) {
        res.status(500).send(error.message);
    } finally {
        await session.close();
    }
});

// 7. 取得預約列表
app.get('/api/appointments', async (req, res) => {
    const session = driver.session();
    try {
        const query = `
            MATCH (a:Appointment)
            OPTIONAL MATCH (p:Patient)-[:HAS_APPOINTMENT]->(a)
            OPTIONAL MATCH (a)-[:ASSIGNED_TO]->(d:Doctor)
            RETURN a, p, d
            ORDER BY a.time ASC
        `;
        const result = await session.run(query);
        const appointments = result.records.map(record => {
            const a = record.get('a').properties;
            const p = record.get('p') ? record.get('p').properties : {};
            const d = record.get('d') ? record.get('d').properties : {};
            
            const toInt = (val) => (val && val.low !== undefined) ? val.low : val;

            return { 
                id: a.id, 
                time: a.time, 
                status: a.status,
                address: a.address || p.address,
                caseDetails: a.caseDetails,
                patientName: p.name,
                patientId: p.id,
                patientAge: toInt(p.age), 
                patientBlood: p.blood_type,
                patientRh: p.rhesus,
                doctorName: d.name,
                doctorId: d.id,
            };
        });
        res.json(appointments);
    } catch (error) {
        res.status(500).send(error.message);
    } finally {
        await session.close();
    }
});

// 8. 刪除預約
app.delete('/api/appointments/:appointId', async (req, res) => {
    const { appointId } = req.params;
    const session = driver.session();
    try {
        await session.run(`MATCH (a:Appointment {id: $appointId}) DETACH DELETE a`, { appointId });
        res.json({ message: `Appointment ${appointId} deleted.` });
    } catch (error) {
        res.status(500).send(error.message);
    } finally {
        await session.close();
    }
});

// 9. 取得醫生路徑 (僅回傳病人位置)
app.get('/api/route/:doctorId', async (req, res) => {
    const { doctorId } = req.params;
    const session = driver.session();
    try {
        const query = `
            MATCH (d:Doctor {id: $doctorId})<-[:ASSIGNED_TO]-(a:Appointment)<-[:HAS_APPOINTMENT]-(p:Patient)
            RETURN p.id as pid, p.name as patient, a.time as time
            ORDER BY a.time ASC
        `;
        const result = await session.run(query, { doctorId });
        
        let route = [];
        result.records.forEach(record => {
            const pid = record.get('pid');
            const patientName = record.get('patient');
            const time = record.get('time');

            if (pid) {
                const loc = getLocation(pid);
                route.push({
                    type: 'Patient',
                    name: patientName,
                    lat: loc.lat, 
                    lng: loc.lng,
                    time: time
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

// 10. 修改預約
app.put('/api/appointments/:appointId', async (req, res) => {
    const { appointId } = req.params;
    const { patientId, doctorId, time } = req.body;
    const session = driver.session();

    try {
        const query = `
            MATCH (a:Appointment {id: $appointId})
            OPTIONAL MATCH (a)-[r1:ASSIGNED_TO]->()
            OPTIONAL MATCH ()-[r2:HAS_APPOINTMENT]->(a)
            DELETE r1, r2
            SET a.time = $time
            WITH a
            MATCH (p:Patient {id: $patientId})
            MATCH (d:Doctor {id: $doctorId})
            CREATE (p)-[:HAS_APPOINTMENT]->(a)
            CREATE (a)-[:ASSIGNED_TO]->(d)
            RETURN a
        `;
        
        await session.run(query, { appointId, patientId, doctorId, time });
        res.json({ message: `Appointment ${appointId} updated.` });
    } catch (error) {
        res.status(500).send(error.message);
    } finally {
        await session.close();
    }
});

const PORT = 5001; 
app.listen(PORT, () => {
  console.log(`Backend Server running on: http://localhost:${PORT}`);
});