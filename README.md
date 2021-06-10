# Node.js Tree Backend

1. **set** .env database credentials

2. **npm install**
3. **npm start**

4. **POST** to http://localhost:4000/api/nodes/create/
with JSON body


```json
    {
        "parentId": null,
        "name": "Main",
        "port": 1,
        "IP": "192.168.1.1" 
    }
```


