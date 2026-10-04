Jobs:
python -m scripts.import_man_month --month=JUN ".\integration\BCT Man Month Report.xlsx" --apply

Kill:
netstat -ano | findstr :3000   
taskkill /PID 1788 /F    

FE:
cd frontend
npm run dev

npm run build
npm run start

BE:
cd backend
 .\.venv\Scripts\uvicorn.exe app.main:app --reload --host 0.0.0.0 --port 8000


GIT:
git add .
git commit -m "before sticky button"      
git push -u origin left-menu-changes    
git checkout -b "left-menu-changes"

SQL:
psql -h 192.168.1.175 -U postgres -d Project_Governance_03 -f Project_Governance_Live_23_09.sql  
createdb -h 192.168.1.175 -U postgres Project_Governance_03     
pg_dump -h 192.168.1.175 -U postgres -d Project_Governance_Live -f Project_Governance_Live_23_09.sql 