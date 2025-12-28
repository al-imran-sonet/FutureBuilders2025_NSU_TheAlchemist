# FutureBuilders2025_NSU_TheAlchemist
Hackathon solution 





# ShasthoBondhu – AI Doctor Care + Medicine Delivery (Web + SMS)

## Overview
**ShasthoBondhu** is a lightweight healthcare support platform for Bangladesh’s **hill tracts and rural areas**, where doctors, pharmacies, and internet access are limited. It provides **AI doctor guidance** and **medicine ordering & delivery**, through both **Web** and **SMS**.

---

## Key Features
### 1) AI Doctor Care (Web + SMS)
Users describe symptoms in **Bangla** via website or SMS.  
Using **Perplexity AI**, the system returns:
- urgency level (Emergency / Urgent / Routine / Self-care)
- simple safe advice + danger signs

Web → full advice  
SMS → short prescription-style summary

### 2) Medicine Ordering + Delivery
Users order medicines via website or SMS (`MED ORS 3, Paracetamol 10`).  
Orders appear in an **Admin Dashboard** where volunteers/NGOs can:
- view orders
- assign delivery person
- update status (pending → delivered)

---

## Offline SMS Support
An **Android phone acts as an SMS gateway**:
- receives SMS from users
- forwards to backend via Wi-Fi
- sends reply SMS back

---

## Tech Stack
- Frontend: HTML + CSS + JavaScript  
- Backend: Node.js + Express  
- AI: Perplexity API  
- Storage: JSON (upgradeable)  
- SMS: Android gateway / future BD SMS gateway integration

