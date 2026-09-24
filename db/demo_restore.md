pg_dump -h 192.168.1.175 -U postgres -d Project_Governance_Live -f backup.sql


createdb -h 192.168.1.175 -U postgres Project_Governance_03
psql -h 192.168.1.175 -U postgres -d Project_Governance_03 -f Project_Governance_Live_23_09.sql