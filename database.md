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
    document($username){
        fields:{
            files:{

            },
            folders:{

            }
        },
        documents("details"):{
            ... masih mikir
        }
        }
    }
    }
```

<!-- di directory, keynya pake username. buat open posibility kedepannya bisa pake username(gaharus google auth) -->
<!-- and keknya kita pake username as the primary way to recognize user deh. i think it's healthier -->
