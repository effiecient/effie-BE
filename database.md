# schema firestore database

```
collection('users'){
fields:{
    },
    document($googleUID){
        fields:{
            username: string,
        }
    }
}


collection('directory'){
    document("christojeffrey"){ //username
        fields:{
            type: "folder",
            isPinned:false,
            childrens:{
                "google":{ // it's relative path
                    type: "file",
                    isPinned:false,
                    link:"https://google.com",
                    title:"Google",
                },
                "sem5":{
                    type: "folder",
                    isPinned:false,
                    title:"Semester 5"
                }
            ]
        },
        collection("childrens"):{
            document("google"){
                fields:{
                    type: "link",
                    isPinned:false,
                    link:"https://google.com",
                    title:"Google",
                }
            }
            document("sem5"){
                fields:{
                    type: "folder",
                    isPinned:false,
                    title:"Semester 5"
                }
            }
        }
    }
}
```

<!-- di directory, keynya pake username. buat open posibility kedepannya bisa pake username(gaharus google auth) -->
<!-- and keknya kita pake username as the primary way to recognize user deh. i think it's healthier -->
